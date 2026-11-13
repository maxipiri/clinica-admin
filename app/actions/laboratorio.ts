"use server";

import { getClinicId } from "@/lib/supabase/clinic";
import type { TreatmentCategory } from "@/app/actions/atenciones";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LabStatus =
  | "draft"
  | "sent"
  | "received"
  | "installed"
  | "cancelled";

export type Lab = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
};

export type LabOrder = {
  id: string;
  lab_id: string;
  lab_name?: string;
  patient_name: string;
  dentist_name: string;
  work_type: string;
  description: string | null;
  sent_date: string;
  due_date: string | null;
  received_date: string | null;
  installed_date: string | null;
  status: LabStatus;
  lab_cost: number;
  charged_to_patient: number;
  billing_month: string | null;
  lab_paid: boolean;
  lab_paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  is_overdue: boolean;
  /** Tipo de tratamiento (define el color de la tarjeta) */
  category: TreatmentCategory;
  /** Historial de cambios de estado (más antiguo primero) */
  events: LabOrderEvent[];
};

export type LabOrderEvent = {
  id: string;
  from_status: LabStatus | null;
  to_status: LabStatus;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
  /** Etapa del trabajo (modelo, rodete, enfilado, terminación...) */
  stage: string | null;
  direction: "sent" | "received" | "installed" | "other" | null;
  /** Fecha real del movimiento (puede ser anterior al registro) */
  event_date: string | null;
};

export type LabBillingSummary = {
  lab_id: string;
  lab_name: string;
  month: string;          // "YYYY-MM-01"
  total: number;
  orders: LabOrder[];
  already_paid: boolean;
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const labSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  contact: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

const orderSchema = z.object({
  lab_id: z.string().uuid("Laboratorio inválido"),
  patient_name: z.string().min(1, "Nombre del paciente obligatorio").max(120),
  dentist_name: z.string().min(1, "Nombre del dentista obligatorio").max(120),
  work_type: z.string().min(1, "Tipo de trabajo obligatorio").max(120),
  description: z.string().max(500).optional(),
  sent_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  lab_cost: z.coerce.number().int().min(0),
  charged_to_patient: z.coerce.number().int().min(0),
  billing_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Mes inválido (YYYY-MM)")
    .optional()
    .or(z.literal("")),
});

const statusSchema = z.object({
  status: z.enum(["draft", "sent", "received", "installed", "cancelled"]),
  received_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  installed_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

// ─── Helper ───────────────────────────────────────────────────────────────────


/** Convierte "YYYY-MM" a "YYYY-MM-01" para guardar como date en Postgres */
function monthToDate(month: string): string {
  return `${month}-01`;
}

// ─── LABORATORIOS ─────────────────────────────────────────────────────────────

export async function getLabs(onlyActive = true): Promise<Lab[]> {
  try {
    const { supabase } = await getClinicId();
    let q = supabase
      .from("labs")
      .select("id, name, contact, phone, email, active")
      .order("name");
    if (onlyActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) {
      console.warn("getLabs warning:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("getLabs error:", err);
    return [];
  }
}

export async function createLab(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = labSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase, clinic_id } = await getClinicId();
    const { error } = await supabase.from("labs").insert({
      clinic_id,
      name: parsed.data.name.trim(),
      contact: parsed.data.contact?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
    });
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateLab(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = labSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("labs")
      .update({
        name: parsed.data.name.trim(),
        contact: parsed.data.contact?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
      })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleLabActive(
  id: string,
  active: boolean
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("labs")
      .update({ active })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── ÓRDENES ─────────────────────────────────────────────────────────────────

/** Todas las órdenes activas (sin anuladas). */
export async function getLabOrders(filters?: {
  status?: LabStatus;
  lab_id?: string;
  onlyUnpaid?: boolean;
}): Promise<LabOrder[]> {
  try {
    const { supabase } = await getClinicId();

    let q = supabase
      .from("lab_orders")
      .select(
        `id, lab_id, patient_name, dentist_name, work_type, description,
         sent_date, due_date, received_date, installed_date,
         status, lab_cost, charged_to_patient, billing_month,
         lab_paid, lab_paid_at, voided_at, created_at,
         labs(name),
         lab_order_events(id, from_status, to_status, changed_by_name, note, created_at, stage, direction, event_date)`
      )
      .is("voided_at", null)
      .order("created_at", { ascending: false });

    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.lab_id) q = q.eq("lab_id", filters.lab_id);
    if (filters?.onlyUnpaid) q = q.eq("lab_paid", false);

    const { data, error } = await q;
    if (error) {
      console.warn("getLabOrders warning:", error.message);
      return [];
    }

    // Categoría de cada orden: la de la atención que la creó (si existe)
    const ids = (data ?? []).map((o: any) => o.id);
    const catByOrder = new Map<string, TreatmentCategory>();
    if (ids.length > 0) {
      const { data: appts } = await supabase
        .from("appointments_work")
        .select("lab_order_id, category")
        .in("lab_order_id", ids);
      for (const a of (appts ?? []) as any[]) {
        if (a.lab_order_id && a.category) catByOrder.set(a.lab_order_id, a.category);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    return (data ?? []).map((o: any) => ({
      ...o,
      category: catByOrder.get(o.id) ?? guessCategory(o.work_type),
      lab_name: o.labs?.name ?? null,
      labs: undefined,
      events: ((o.lab_order_events ?? []) as LabOrderEvent[]).sort(
        (a, b) =>
          (a.event_date ?? a.created_at.slice(0, 10)).localeCompare(b.event_date ?? b.created_at.slice(0, 10)) ||
          a.created_at.localeCompare(b.created_at)
      ),
      lab_order_events: undefined,
      is_overdue:
        !o.lab_paid &&
        o.due_date &&
        o.due_date < today &&
        !["installed", "cancelled"].includes(o.status),
    }));
  } catch (err) {
    console.warn("getLabOrders error:", err);
    return [];
  }
}

export async function createLabOrder(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase, clinic_id, user_id } = await getClinicId();
    const { error } = await supabase.from("lab_orders").insert({
      clinic_id,
      created_by: user_id,
      lab_id: parsed.data.lab_id,
      patient_name: parsed.data.patient_name.trim(),
      dentist_name: parsed.data.dentist_name.trim(),
      work_type: parsed.data.work_type.trim(),
      description: parsed.data.description?.trim() || null,
      sent_date: parsed.data.sent_date,
      due_date: parsed.data.due_date || null,
      lab_cost: parsed.data.lab_cost,
      charged_to_patient: parsed.data.charged_to_patient,
      billing_month: parsed.data.billing_month
        ? monthToDate(parsed.data.billing_month)
        : null,
      status: "sent",
    });
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateOrderStatus(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = statusSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("lab_orders")
      .update({
        status: parsed.data.status,
        received_date: parsed.data.received_date || null,
        installed_date: parsed.data.installed_date || null,
      })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function voidLabOrder(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  try {
    if (!reason.trim()) return { error: "El motivo es obligatorio" };
    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("lab_orders")
      .update({ voided_at: new Date().toISOString(), void_reason: reason.trim() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── CUENTAS POR PAGAR ───────────────────────────────────────────────────────

/** Resumen de deuda agrupado por lab + mes de facturación. */
export async function getLabBillingSummary(): Promise<LabBillingSummary[]> {
  try {
    const orders = await getLabOrders({ onlyUnpaid: true });

    const map = new Map<string, LabBillingSummary>();

    for (const order of (orders ?? [])) {
      if (!order.billing_month || order.status === "cancelled") continue;
      const key = `${order.lab_id}__${order.billing_month}`;
      if (!map.has(key)) {
        map.set(key, {
          lab_id: order.lab_id,
          lab_name: order.lab_name ?? "Sin nombre",
          month: order.billing_month,
          total: 0,
          orders: [],
          already_paid: false,
        });
      }
      const summary = map.get(key)!;
      summary.total += order.lab_cost;
      summary.orders.push(order);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.month < b.month ? -1 : 1
    );
  } catch (err) {
    console.warn("getLabBillingSummary error:", err);
    return [];
  }
}

/** Registra el pago a un laboratorio por mes:
 *  - Marca órdenes del mes como pagadas
 *  - Crea egreso en caja
 */
export async function payLabMonth(data: {
  lab_id: string;
  month: string;      // "YYYY-MM-01"
  total: number;
  method: string;
  notes?: string;
}): Promise<{ error: string | null }> {
  try {
    const { supabase, clinic_id, user_id } = await getClinicId();

    // 1. Crear egreso en caja
    const { data: movement, error: movErr } = await supabase
      .from("cash_movements")
      .insert({
        clinic_id,
        created_by: user_id,
        date: new Date().toISOString().split("T")[0],
        type: "expense",
        amount: data.total,
        payment_method: data.method,
        description: `Pago laboratorio — ${data.month.substring(0, 7)}`,
      })
      .select("id")
      .single();

    if (movErr) return { error: movErr.message };

    // 2. Registrar el pago
    const { error: payErr } = await supabase.from("lab_payments").upsert(
      {
        clinic_id,
        lab_id: data.lab_id,
        month: data.month,
        total: data.total,
        method: data.method,
        notes: data.notes ?? null,
        cash_movement_id: movement.id,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,lab_id,month" }
    );

    if (payErr) return { error: payErr.message };

    // 3. Marcar las órdenes como pagadas
    const { error: ordErr } = await supabase
      .from("lab_orders")
      .update({ lab_paid: true, lab_paid_at: new Date().toISOString() })
      .eq("lab_id", data.lab_id)
      .eq("billing_month", data.month)
      .eq("lab_paid", false);

    if (ordErr) return { error: ordErr.message };

    revalidatePath("/laboratorio");
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Registra una ida o vuelta del trabajo (envío al laboratorio, recepción,
 * instalación) con su etapa y la fecha real. Actualiza el estado de la orden.
 */
export async function registerLabStep(data: {
  order_id: string;
  stage: string;
  direction: "sent" | "received" | "installed" | "other";
  event_date: string;
  note?: string;
}): Promise<{ error: string | null }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.event_date)) return { error: "Fecha inválida" };
    if (!data.stage.trim()) return { error: "Elige el movimiento" };
    const { supabase } = await getClinicId();
    const { error } = await supabase.rpc("register_lab_step", {
      p_order_id: data.order_id,
      p_stage: data.stage.trim(),
      p_direction: data.direction,
      p_event_date: data.event_date,
      p_note: data.note?.trim() || null,
    });
    if (error) return { error: error.message };
    revalidatePath("/laboratorio");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Para órdenes creadas a mano (sin atención): deduce el tratamiento por el nombre. */
function guessCategory(workType: string | null): TreatmentCategory {
  const t = (workType ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/implant|corona sobre|pilar/.test(t)) return "implant";
  if (/protesis|protsis|placa|valplast|flexible|acrilic|metalic|rodete|enfilado/.test(t)) return "prosthesis";
  if (/endodon|retratamiento/.test(t)) return "endodontics";
  if (/ortodon|bracket|contencion|retenedor|alineador/.test(t)) return "orthodontics";
  if (/carilla|blanqueamiento|estetic/.test(t)) return "aesthetics";
  return "general";
}
