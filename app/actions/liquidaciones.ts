"use server";

import { getClinicId } from "@/lib/supabase/clinic";
import { revalidatePath } from "next/cache";
import { computeDentistPay, effectivePayMode } from "@/lib/dentist-pay";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type SettlementStatus = "draft" | "approved" | "paid";

export type Settlement = {
  id: string;
  dentist_id: string;
  dentist_name?: string;
  month: string; // YYYY-MM-01
  gross_total: number;
  lab_discounts: number;
  commission_pct: number;
  amount_due: number;
  status: SettlementStatus;
  paid_at: string | null;
  created_at: string;
  items_count?: number;
};

export type SettlementPreview = {
  dentist_id: string;
  dentist_name: string;
  commission_pct: number;
  commission_base: "gross" | "net";
  pay_mode: "commission" | "fixed";
  fixed_fee: number | null;
  month: string;
  gross_total: number;
  lab_discounts: number;
  net_base: number;
  amount_due: number;
  appointments: {
    id: string;
    date: string;
    patient_name: string;
    description: string;
    amount: number;
    paid_amount: number;
    /** Pago al dentista por esta atención (fijo o %) */
    commission_amount: number;
    pay_mode: "commission" | "fixed";
  }[];
};

// ─── Helper ───────────────────────────────────────────────────────────────────


// ─── Consultas ───────────────────────────────────────────────────────────────

export async function getSettlements(month?: string): Promise<Settlement[]> {
  try {
    const { supabase } = await getClinicId();
    let q = supabase
      .from("dentist_settlements")
      .select(
        `id, dentist_id, month, gross_total, lab_discounts, commission_pct,
         amount_due, status, paid_at, created_at,
         dentists(full_name)`
      )
      .order("month", { ascending: false })
      .order("created_at", { ascending: false });

    if (month) q = q.eq("month", `${month}-01`);

    const { data, error } = await q;
    if (error) {
      console.warn("getSettlements warning:", error.message);
      return [];
    }

    return (data ?? []).map((s: any) => ({
      ...s,
      dentist_name: s.dentists?.full_name ?? "Dentista",
      commission_pct: Number(s.commission_pct),
      dentists: undefined,
    }));
  } catch (err) {
    console.warn("getSettlements error:", err);
    return [];
  }
}

/** Previsualiza el cálculo de liquidación para un dentista en un mes determinado (YYYY-MM). */
export async function calculateSettlementPreview(
  dentist_id: string,
  monthStr: string // Formato: "YYYY-MM"
): Promise<{ data: SettlementPreview | null; error: string | null }> {
  try {
    const { supabase, clinic_id } = await getClinicId();

    // 1. Obtener datos del dentista
    const { data: dentist, error: dentError } = await supabase
      .from("dentists")
      .select("id, full_name, commission_pct, commission_base, pay_mode, fixed_fee")
      .eq("id", dentist_id)
      .single();

    if (dentError || !dentist) return { data: null, error: "Dentista no encontrado" };

    // 2. Obtener atenciones del mes
    const startDate = `${monthStr}-01`;
    // Último día del mes aproximado o siguiente mes
    const [year, month] = monthStr.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const { data: appts, error: apptsError } = await supabase
      .from("appointments_work")
      .select(
        "id, date, description, amount, paid_amount, lab_cost, supplies_cost, dentist_pay_mode, dentist_pct, dentist_fixed, patients(full_name)"
      )
      .eq("clinic_id", clinic_id)
      .eq("dentist_id", dentist_id)
      .gte("date", startDate)
      .lt("date", endDate)
      .is("voided_at", null);

    if (apptsError) return { data: null, error: apptsError.message };

    const defaults = {
      pay_mode: (dentist.pay_mode ?? "commission") as "commission" | "fixed",
      fixed_fee: dentist.fixed_fee ?? null,
      commission_pct: Number(dentist.commission_pct),
      commission_base: dentist.commission_base as "gross" | "net",
    };

    // Cada atención se liquida según su propio trato:
    //  - monto fijo  -> el monto completo (ej. implantólogo $250.000)
    //  - porcentaje  -> % sobre lo efectivamente cobrado (menos lab e insumos si la base es neta)
    let lab_discounts = 0;
    const appointments = (appts ?? []).map((a: any) => {
      const costs = {
        base: a.paid_amount,
        lab_cost: a.lab_cost ?? 0,
        supplies_cost: a.supplies_cost ?? 0,
        dentist_pay_mode: a.dentist_pay_mode,
        dentist_pct: a.dentist_pct != null ? Number(a.dentist_pct) : null,
        dentist_fixed: a.dentist_fixed,
      };
      const pay_mode = effectivePayMode(costs, defaults);
      if (pay_mode === "commission" && defaults.commission_base === "net") {
        lab_discounts += costs.lab_cost + costs.supplies_cost;
      }
      return {
        id: a.id,
        date: a.date,
        patient_name: a.patients?.full_name ?? "Paciente",
        description: a.description,
        amount: a.amount,
        paid_amount: a.paid_amount,
        commission_amount: computeDentistPay(costs, defaults),
        pay_mode,
      };
    });

    // Se calcula sobre el monto efectivamente cobrado
    const gross_total = appointments.reduce((sum, a) => sum + a.paid_amount, 0);
    const net_base = Math.max(0, gross_total - lab_discounts);
    const commission_pct = defaults.commission_pct;
    const amount_due = appointments.reduce((sum, a) => sum + a.commission_amount, 0);

    return {
      data: {
        dentist_id: dentist.id,
        dentist_name: dentist.full_name,
        commission_pct,
        commission_base: dentist.commission_base,
        pay_mode: defaults.pay_mode,
        fixed_fee: defaults.fixed_fee,
        month: startDate,
        gross_total,
        lab_discounts,
        net_base,
        amount_due,
        appointments,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export async function saveSettlementDraft(data: {
  dentist_id: string;
  monthStr: string; // YYYY-MM
}): Promise<{ error: string | null }> {
  try {
    const previewRes = await calculateSettlementPreview(data.dentist_id, data.monthStr);
    if (previewRes.error || !previewRes.data) return { error: previewRes.error || "Error al calcular" };

    const p = previewRes.data;
    const { supabase, clinic_id, user_id } = await getClinicId();

    // Guardar o actualizar liquidación
    const { data: settlement, error: setErr } = await supabase
      .from("dentist_settlements")
      .upsert(
        {
          clinic_id,
          created_by: user_id,
          dentist_id: p.dentist_id,
          month: p.month,
          gross_total: p.gross_total,
          lab_discounts: p.lab_discounts,
          commission_pct: p.commission_pct,
          amount_due: p.amount_due,
          status: "draft",
        },
        { onConflict: "clinic_id,dentist_id,month" }
      )
      .select("id")
      .single();

    if (setErr) return { error: setErr.message };

    // Limpiar ítems anteriores y reinsertar
    await supabase.from("dentist_settlement_items").delete().eq("settlement_id", settlement.id);

    if (p.appointments.length > 0) {
      const items = p.appointments.map((a) => ({
        clinic_id,
        settlement_id: settlement.id,
        appointment_id: a.id,
        base_amount: a.paid_amount,
        commission_amount: a.commission_amount,
      }));
      await supabase.from("dentist_settlement_items").insert(items);
    }

    revalidatePath("/liquidaciones");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function paySettlement(data: {
  settlement_id: string;
  payment_method: string;
}): Promise<{ error: string | null }> {
  try {
    const { supabase, clinic_id, user_id } = await getClinicId();

    const { data: s, error: findErr } = await supabase
      .from("dentist_settlements")
      .select("id, amount_due, month, dentists(full_name)")
      .eq("id", data.settlement_id)
      .single();

    if (findErr || !s) return { error: "Liquidación no encontrada" };

    const dentistName = (s as any).dentists?.full_name ?? "Dentista";
    const today = new Date().toISOString().split("T")[0];

    // 1. Crear egreso en caja
    const { data: movement, error: movErr } = await supabase
      .from("cash_movements")
      .insert({
        clinic_id,
        created_by: user_id,
        date: today,
        type: "expense",
        amount: s.amount_due,
        payment_method: data.payment_method,
        description: `Liquidación honorarios — ${dentistName} (${s.month.substring(0, 7)})`,
      })
      .select("id")
      .single();

    if (movErr) return { error: movErr.message };

    // 2. Marcar liquidación como pagada
    const { error: updErr } = await supabase
      .from("dentist_settlements")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        cash_movement_id: movement.id,
      })
      .eq("id", s.id);

    if (updErr) return { error: updErr.message };

    revalidatePath("/liquidaciones");
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
