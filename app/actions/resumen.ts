"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getAppointments, type TreatmentCategory } from "@/app/actions/atenciones";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type MonthSummary = {
  month: string; // YYYY-MM
  appointments_count: number;
  production: number; // valor de las atenciones realizadas en el mes
  dentists: number; // pago a dentistas por esas atenciones
  lab: number; // laboratorio
  supplies: number; // insumos
  expenses: number; // gastos del mes (caja), sin laboratorio ni liquidaciones
  profit: number; // ganancia real = producción - dentistas - lab - insumos - gastos
  collected: number; // ingresos que entraron a caja en el mes
  pending_from_month: number; // saldo por cobrar de las atenciones del mes
  by_category: { category: TreatmentCategory; production: number; profit: number; count: number }[];
  expenses_by_category: { name: string; amount: number }[];
};

export type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  active: boolean;
  loaded: boolean; // ya cargado como egreso en el mes consultado
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getClinicId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) throw new Error("Perfil sin clínica");
  return { supabase, clinic_id: profile.clinic_id as string, user_id: user.id };
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido");

// ─── Resumen del mes ─────────────────────────────────────────────────────────

export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const empty: MonthSummary = {
    month,
    appointments_count: 0,
    production: 0,
    dentists: 0,
    lab: 0,
    supplies: 0,
    expenses: 0,
    profit: 0,
    collected: 0,
    pending_from_month: 0,
    by_category: [],
    expenses_by_category: [],
  };
  try {
    monthSchema.parse(month);
    const { supabase } = await getClinicId();
    const { start, end } = monthRange(month);

    const appts = (await getAppointments()).filter((a) => a.date >= start && a.date < end);

    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id, type, amount, cash_categories(name)")
      .gte("date", start)
      .lt("date", end)
      .is("voided_at", null);

    // Los egresos por pagos a laboratorio y liquidaciones de dentistas ya se cuentan
    // en "laboratorio" y "dentistas" (por atención), así que no se suman dos veces.
    const [{ data: labPays }, { data: settlements }] = await Promise.all([
      supabase.from("lab_payments").select("cash_movement_id").not("cash_movement_id", "is", null),
      supabase.from("dentist_settlements").select("cash_movement_id").not("cash_movement_id", "is", null),
    ]);
    const excluded = new Set([
      ...(labPays ?? []).map((r: any) => r.cash_movement_id),
      ...(settlements ?? []).map((r: any) => r.cash_movement_id),
    ]);

    let collected = 0;
    let expenses = 0;
    const byExpense = new Map<string, number>();
    for (const m of (movs ?? []) as any[]) {
      if (m.type === "income") collected += m.amount;
      else if (!excluded.has(m.id)) {
        expenses += m.amount;
        const name = m.cash_categories?.name ?? "Sin categoría";
        byExpense.set(name, (byExpense.get(name) ?? 0) + m.amount);
      }
    }

    const sum = (f: (a: (typeof appts)[number]) => number) => appts.reduce((s, a) => s + f(a), 0);
    const production = sum((a) => a.amount);
    const dentists = sum((a) => a.dentist_pay);
    const lab = sum((a) => a.lab_cost);
    const supplies = sum((a) => a.supplies_cost);

    const cats: TreatmentCategory[] = ["prosthesis", "implant", "endodontics", "orthodontics", "aesthetics", "general"];
    const by_category = cats.map((category) => {
      const list = appts.filter((a) => a.category === category);
      return {
        category,
        count: list.length,
        production: list.reduce((s, a) => s + a.amount, 0),
        profit: list.reduce((s, a) => s + a.clinic_profit, 0),
      };
    });

    return {
      month,
      appointments_count: appts.length,
      production,
      dentists,
      lab,
      supplies,
      expenses,
      profit: production - dentists - lab - supplies - expenses,
      collected,
      pending_from_month: sum((a) => Math.max(0, a.amount - a.paid_amount)),
      by_category,
      expenses_by_category: [...byExpense.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  } catch (err) {
    console.warn("getMonthSummary error:", err);
    return empty;
  }
}

// ─── Gastos fijos ────────────────────────────────────────────────────────────

export async function getRecurringExpenses(month: string): Promise<RecurringExpense[]> {
  try {
    monthSchema.parse(month);
    const { supabase } = await getClinicId();
    const { start, end } = monthRange(month);
    const [{ data: list, error }, { data: loaded }] = await Promise.all([
      supabase.from("recurring_expenses").select("id, name, amount, active").order("name"),
      supabase
        .from("cash_movements")
        .select("recurring_expense_id")
        .not("recurring_expense_id", "is", null)
        .gte("date", start)
        .lt("date", end)
        .is("voided_at", null),
    ]);
    if (error) {
      console.warn("getRecurringExpenses warning:", error.message);
      return [];
    }
    const loadedIds = new Set((loaded ?? []).map((r: any) => r.recurring_expense_id));
    return (list ?? []).map((r: any) => ({ ...r, loaded: loadedIds.has(r.id) }));
  } catch (err) {
    console.warn("getRecurringExpenses error:", err);
    return [];
  }
}

/** Carga como egreso en caja los gastos fijos activos que aún no se cargan en el mes. */
export async function loadRecurringExpenses(month: string): Promise<{ error: string | null; loaded?: number }> {
  try {
    monthSchema.parse(month);
    const { supabase, clinic_id, user_id } = await getClinicId();
    const list = (await getRecurringExpenses(month)).filter((r) => r.active && !r.loaded);
    if (list.length === 0) return { error: null, loaded: 0 };

    const { data: full } = await supabase
      .from("recurring_expenses")
      .select("id, category_id, payment_method")
      .in("id", list.map((r) => r.id));
    const { data: fallbackCat } = await supabase
      .from("cash_categories")
      .select("id")
      .eq("type", "expense")
      .ilike("name", "otros%")
      .limit(1)
      .maybeSingle();

    const rows = list.map((r) => {
      const f = (full ?? []).find((x: any) => x.id === r.id) as any;
      return {
        clinic_id,
        created_by: user_id,
        date: `${month}-01`,
        type: "expense",
        category_id: f?.category_id ?? fallbackCat?.id ?? null,
        amount: r.amount,
        payment_method: f?.payment_method ?? "transfer",
        description: `Gasto fijo — ${r.name}`,
        recurring_expense_id: r.id,
      };
    });
    const { error } = await supabase.from("cash_movements").insert(rows);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/caja");
    return { error: null, loaded: rows.length };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const recurringSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  amount: z.coerce.number().int().positive("El monto debe ser mayor a 0"),
});

export async function saveRecurringExpense(
  data: { id?: string; name: string; amount: number }
): Promise<{ error: string | null }> {
  try {
    const parsed = recurringSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.errors[0].message };
    const { supabase, clinic_id } = await getClinicId();
    const { error } = data.id
      ? await supabase.from("recurring_expenses").update(parsed.data).eq("id", data.id)
      : await supabase.from("recurring_expenses").insert({ clinic_id, ...parsed.data });
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleRecurringExpense(id: string, active: boolean): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getClinicId();
    const { error } = await supabase.from("recurring_expenses").update({ active }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
