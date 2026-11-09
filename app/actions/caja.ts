"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "transfer" | "debit" | "credit" | "other";
export type MovementType = "income" | "expense";

export type CashCategory = {
  id: string;
  name: string;
  type: MovementType;
  active: boolean;
};

export type CashMovement = {
  id: string;
  date: string;
  type: MovementType;
  category_id: string | null;
  category_name?: string;
  amount: number;
  payment_method: PaymentMethod;
  description: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

export type CashClosing = {
  id: string;
  date: string;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  notes: string | null;
};

export type DaySummary = {
  total_income: number;
  total_expense: number;
  by_method: Record<PaymentMethod, { income: number; expense: number }>;
  closing: CashClosing | null;
};

// ─── Schemas de validación ───────────────────────────────────────────────────

const movementSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  type: z.enum(["income", "expense"]),
  category_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().int().positive("El monto debe ser positivo"),
  payment_method: z.enum(["cash", "transfer", "debit", "credit", "other"]),
  description: z.string().min(1, "La descripción es obligatoria").max(255),
});

const closingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  counted_cash: z.coerce.number().int().min(0, "Monto inválido"),
  notes: z.string().max(500).optional(),
});

// ─── Helper: obtener clinic_id ────────────────────────────────────────────────

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

// ─── CATEGORÍAS ──────────────────────────────────────────────────────────────

/** Lista las categorías activas de la clínica. */
export async function getCashCategories(): Promise<CashCategory[]> {
  try {
    const { supabase } = await getClinicId();
    const { data, error } = await supabase
      .from("cash_categories")
      .select("id, name, type, active")
      .eq("active", true)
      .order("type")
      .order("name");

    if (error) {
      console.warn("getCashCategories warning:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("getCashCategories error:", err);
    return [];
  }
}

/** Inicializa las categorías por defecto si la clínica no tiene ninguna. */
export async function initDefaultCategories(): Promise<void> {
  try {
    const { supabase, clinic_id } = await getClinicId();

    const { count, error } = await supabase
      .from("cash_categories")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic_id);

    if (error || (count ?? 0) > 0) return; // Ya tiene categorías o tabla no lista

    const defaults = [
      // Ingresos
      { clinic_id, name: "Arriendo box", type: "income" },
      { clinic_id, name: "Consulta / honorarios", type: "income" },
      { clinic_id, name: "Venta insumos", type: "income" },
      { clinic_id, name: "Otros ingresos", type: "income" },
      // Egresos
      { clinic_id, name: "Insumos / materiales", type: "expense" },
      { clinic_id, name: "Laboratorio (prótesis)", type: "expense" },
      { clinic_id, name: "Arriendo local", type: "expense" },
      { clinic_id, name: "Servicios básicos", type: "expense" },
      { clinic_id, name: "Remuneraciones / comisiones", type: "expense" },
      { clinic_id, name: "Mantención equipos", type: "expense" },
      { clinic_id, name: "Otros egresos", type: "expense" },
    ];

    await supabase.from("cash_categories").insert(defaults);
    revalidatePath("/caja");
  } catch (err) {
    console.warn("initDefaultCategories error:", err);
  }
}

/** Crea una nueva categoría. */
export async function createCashCategory(
  name: string,
  type: MovementType
): Promise<{ error: string | null }> {
  try {
    const { supabase, clinic_id } = await getClinicId();
    const { error } = await supabase
      .from("cash_categories")
      .insert({ clinic_id, name: name.trim(), type });
    if (error) return { error: error.message };
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────

/** Movimientos de un día específico (sin anulados por defecto). */
export async function getMovementsByDate(
  date: string,
  includeVoided = false
): Promise<CashMovement[]> {
  try {
    const { supabase } = await getClinicId();

    let query = supabase
      .from("cash_movements")
      .select(
        `id, date, type, category_id, amount, payment_method, description,
         voided_at, void_reason, created_at,
         cash_categories(name)`
      )
      .eq("date", date)
      .order("created_at", { ascending: false });

    if (!includeVoided) {
      query = query.is("voided_at", null);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("getMovementsByDate warning:", error.message);
      return [];
    }

    return (data ?? []).map((m: any) => ({
      ...m,
      category_name: m.cash_categories?.name ?? null,
      cash_categories: undefined,
    }));
  } catch (err) {
    console.warn("getMovementsByDate error:", err);
    return [];
  }
}

/** Resumen del día: totales y cierre. */
export async function getDaySummary(date: string): Promise<DaySummary> {
  const methods: PaymentMethod[] = ["cash", "transfer", "debit", "credit", "other"];
  const byMethod = Object.fromEntries(
    methods.map((m) => [m, { income: 0, expense: 0 }])
  ) as Record<PaymentMethod, { income: number; expense: number }>;

  try {
    const movements = await getMovementsByDate(date);
    const { supabase } = await getClinicId();

    let total_income = 0;
    let total_expense = 0;

    for (const mov of movements) {
      const m = mov.payment_method as PaymentMethod;
      if (mov.type === "income") {
        total_income += mov.amount;
        if (byMethod[m]) byMethod[m].income += mov.amount;
      } else {
        total_expense += mov.amount;
        if (byMethod[m]) byMethod[m].expense += mov.amount;
      }
    }

    const { data: closing } = await supabase
      .from("cash_closings")
      .select("*")
      .eq("date", date)
      .maybeSingle();

    return { total_income, total_expense, by_method: byMethod, closing: closing ?? null };
  } catch (err) {
    console.warn("getDaySummary error:", err);
    return { total_income: 0, total_expense: 0, by_method: byMethod, closing: null };
  }
}

/** Registra un nuevo movimiento. */
export async function createMovement(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = movementSchema.safeParse({
      ...raw,
      category_id: raw.category_id || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    const { supabase, clinic_id, user_id } = await getClinicId();
    const { error } = await supabase.from("cash_movements").insert({
      clinic_id,
      created_by: user_id,
      ...parsed.data,
    });

    if (error) return { error: error.message };
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Anula un movimiento (nunca borra). */
export async function voidMovement(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  try {
    if (!reason.trim()) return { error: "El motivo de anulación es obligatorio" };
    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("cash_movements")
      .update({ voided_at: new Date().toISOString(), void_reason: reason.trim() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── CIERRE DE CAJA ──────────────────────────────────────────────────────────

/** Registra o actualiza el cierre de caja de un día. */
export async function saveCashClosing(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = closingSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    const { supabase, clinic_id, user_id } = await getClinicId();

    // Calcular efectivo esperado (movimientos en efectivo del día)
    const movements = await getMovementsByDate(parsed.data.date);
    const expected_cash = movements
      .filter((m) => m.payment_method === "cash")
      .reduce((sum, m) => sum + (m.type === "income" ? m.amount : -m.amount), 0);

    const { error } = await supabase.from("cash_closings").upsert(
      {
        clinic_id,
        date: parsed.data.date,
        expected_cash,
        counted_cash: parsed.data.counted_cash,
        notes: parsed.data.notes ?? null,
        closed_by: user_id,
      },
      { onConflict: "clinic_id,date" }
    );

    if (error) return { error: error.message };
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
