"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  computeDentistPay,
  computeClinicProfit,
  effectivePayMode,
  type PayMode,
} from "@/lib/dentist-pay";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "partial" | "paid";

export type TreatmentCategory = "general" | "prosthesis" | "implant" | "orthodontics";

export type AppointmentPayment = {
  id: string;
  date: string;
  amount: number;
  payment_method: string;
  description: string;
};

/** Fecha de hoy en Chile (YYYY-MM-DD), no en UTC. */
function todayCL() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

export type TreatmentItem = {
  id: string;
  name: string;
  default_price: number;
  active: boolean;
  category: TreatmentCategory;
  material: string | null;
  extension: string | null;
  lab_cost: number;
};

export type Appointment = {
  id: string;
  date: string;
  patient_id: string;
  patient_name?: string;
  dentist_id: string;
  dentist_name?: string;
  treatment_id: string | null;
  treatment_name?: string;
  description: string;
  amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  voided_at: string | null;
  created_at: string;
  category: TreatmentCategory;
  lab_cost: number;
  supplies_cost: number;
  dentist_pay_mode: PayMode | null;
  dentist_pct: number | null;
  dentist_fixed: number | null;
  crown_qty: number | null;
  lab_order_id: string | null;
  patient_phone?: string | null;
  /** Abonos registrados en caja (con fecha) */
  payments: AppointmentPayment[];
  /** Calculados */
  effective_pay_mode: PayMode;
  dentist_pay: number;
  clinic_profit: number;
};

// ─── Validaciones ────────────────────────────────────────────────────────────

const appointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  patient_id: z.string().uuid("Paciente obligatorio"),
  dentist_id: z.string().uuid("Dentista obligatorio"),
  treatment_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().min(1, "Descripción obligatoria").max(250),
  amount: z.coerce.number().int().min(0, "Monto inválido"),
  paid_amount: z.coerce.number().int().min(0, "Monto pagado inválido"),
  payment_method: z.enum(["cash", "transfer", "debit", "credit", "other"]).optional().or(z.literal("")),
  category: z.enum(["general", "prosthesis", "implant", "orthodontics"]).default("general"),
  crown_qty: z.coerce.number().int().min(0).optional(),
  lab_cost: z.coerce.number().int().min(0, "Costo laboratorio inválido").default(0),
  supplies_cost: z.coerce.number().int().min(0, "Costo insumos inválido").default(0),
  dentist_pay_mode: z.enum(["commission", "fixed"]).optional().or(z.literal("")),
  dentist_pct: z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%").optional(),
  dentist_fixed: z.coerce.number().int().min(0, "Pago fijo inválido").optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Consultas ───────────────────────────────────────────────────────────────

export async function getTreatmentsCatalog(): Promise<TreatmentItem[]> {
  try {
    const { supabase } = await getClinicId();
    const { data, error } = await supabase
      .from("treatments_catalog")
      .select("id, name, default_price, active, category, material, extension, lab_cost")
      .eq("active", true)
      .order("name");

    if (error) {
      console.warn("getTreatmentsCatalog warning:", error.message);
      return [];
    }
    return (data ?? []).map((t: any) => ({
      ...t,
      category: t.category ?? "general",
      lab_cost: t.lab_cost ?? 0,
    }));
  } catch (err) {
    console.warn("getTreatmentsCatalog error:", err);
    return [];
  }
}

export async function getAppointments(filters?: {
  date?: string;
  dentist_id?: string;
  patient_id?: string;
  payment_status?: string;
}): Promise<Appointment[]> {
  try {
    const { supabase } = await getClinicId();
    let q = supabase
      .from("appointments_work")
      .select(
        `id, date, patient_id, dentist_id, treatment_id, description,
         amount, paid_amount, payment_status, voided_at, created_at,
         category, lab_cost, supplies_cost, dentist_pay_mode, dentist_pct, dentist_fixed, crown_qty, lab_order_id,
         cash_movements(id, date, amount, payment_method, description, voided_at, type),
         patients(full_name, phone),
         dentists(full_name, pay_mode, fixed_fee, commission_pct, commission_base),
         treatments_catalog(name)`
      )
      .is("voided_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.date) q = q.eq("date", filters.date);
    if (filters?.dentist_id) q = q.eq("dentist_id", filters.dentist_id);
    if (filters?.patient_id) q = q.eq("patient_id", filters.patient_id);
    if (filters?.payment_status) q = q.eq("payment_status", filters.payment_status);

    const { data, error } = await q;
    if (error) {
      console.warn("getAppointments warning:", error.message);
      return [];
    }

    return (data ?? []).map((a: any) => {
      const d = {
        pay_mode: a.dentists?.pay_mode ?? "commission",
        fixed_fee: a.dentists?.fixed_fee ?? null,
        commission_pct: Number(a.dentists?.commission_pct ?? 0),
        commission_base: a.dentists?.commission_base ?? "gross",
      };
      const costs = {
        base: a.amount,
        lab_cost: a.lab_cost ?? 0,
        supplies_cost: a.supplies_cost ?? 0,
        dentist_pay_mode: a.dentist_pay_mode,
        dentist_pct: a.dentist_pct != null ? Number(a.dentist_pct) : null,
        dentist_fixed: a.dentist_fixed,
      };
      const dentist_pay = computeDentistPay(costs, d);
      return {
      ...a,
      category: a.category ?? "general",
      lab_cost: a.lab_cost ?? 0,
      supplies_cost: a.supplies_cost ?? 0,
      dentist_pct: costs.dentist_pct,
      payments: ((a.cash_movements ?? []) as any[])
        .filter((m) => !m.voided_at && m.type === "income")
        .map((m) => ({
          id: m.id,
          date: m.date,
          amount: m.amount,
          payment_method: m.payment_method,
          description: m.description,
        }))
        .sort((x, y) => x.date.localeCompare(y.date)),
      cash_movements: undefined,
      effective_pay_mode: effectivePayMode(costs, d),
      dentist_pay,
      clinic_profit: computeClinicProfit(a.amount, costs.lab_cost, costs.supplies_cost, dentist_pay),
      patient_name: a.patients?.full_name ?? "Paciente",
      patient_phone: a.patients?.phone ?? null,
      dentist_name: a.dentists?.full_name ?? "Dentista",
      treatment_name: a.treatments_catalog?.name ?? null,
      patients: undefined,
      dentists: undefined,
      treatments_catalog: undefined,
      };
    });
  } catch (err) {
    console.warn("getAppointments error:", err);
    return [];
  }
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

const cartItemSchema = z.object({
  treatment_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Cada tratamiento necesita una descripción").max(250),
  amount: z.coerce.number().int().min(0, "Monto inválido"),
});

function statusFor(amount: number, paid: number): PaymentStatus {
  if (paid >= amount && amount > 0) return "paid";
  if (paid > 0) return "partial";
  return "pending";
}

type Supa = Awaited<ReturnType<typeof getClinicId>>["supabase"];

/**
 * Prótesis e implantes con costo de laboratorio: crea (o actualiza) la orden
 * de laboratorio vinculada, para no tener que anotarla dos veces.
 * Si la orden ya fue pagada al laboratorio, no se toca.
 */
async function syncLabOrder(
  supabase: Supa,
  ctx: { clinic_id: string; user_id: string },
  appt: {
    id: string;
    lab_order_id: string | null;
    category: string;
    lab_cost: number;
    amount: number;
    description: string;
    date: string;
    patient_id: string;
    dentist_id: string;
    treatment_id: string | null;
  }
) {
  try {
    const needsOrder = (appt.category === "prosthesis" || appt.category === "implant") && appt.lab_cost > 0;

    if (appt.lab_order_id) {
      const { data: order } = await supabase
        .from("lab_orders")
        .select("id, lab_paid")
        .eq("id", appt.lab_order_id)
        .maybeSingle();
      if (!order || order.lab_paid) return;
      if (!needsOrder) {
        await supabase
          .from("lab_orders")
          .update({ voided_at: new Date().toISOString(), void_reason: "Atención sin costo de laboratorio" })
          .eq("id", order.id);
        await supabase.from("appointments_work").update({ lab_order_id: null }).eq("id", appt.id);
        return;
      }
    } else if (!needsOrder) {
      return;
    }

    const [{ data: patient }, { data: dentist }] = await Promise.all([
      supabase.from("patients").select("full_name").eq("id", appt.patient_id).maybeSingle(),
      supabase.from("dentists").select("full_name").eq("id", appt.dentist_id).maybeSingle(),
    ]);
    const fields = {
      patient_name: patient?.full_name ?? "Paciente",
      dentist_name: dentist?.full_name ?? "Dentista",
      work_type: appt.description,
      lab_cost: appt.lab_cost,
      charged_to_patient: appt.amount,
      billing_month: `${appt.date.slice(0, 7)}-01`,
    };

    if (appt.lab_order_id) {
      await supabase.from("lab_orders").update(fields).eq("id", appt.lab_order_id);
      return;
    }

    // Laboratorio: el del catálogo, o Loreto, o el primero activo
    let lab_id: string | null = null;
    if (appt.treatment_id) {
      const { data: t } = await supabase
        .from("treatments_catalog")
        .select("lab_id")
        .eq("id", appt.treatment_id)
        .maybeSingle();
      lab_id = t?.lab_id ?? null;
    }
    if (!lab_id) {
      const { data: labs } = await supabase
        .from("labs")
        .select("id, name")
        .eq("active", true)
        .order("created_at");
      lab_id = labs?.find((l: any) => /loret/i.test(l.name))?.id ?? labs?.[0]?.id ?? null;
    }
    if (!lab_id) return;

    const { data: created } = await supabase
      .from("lab_orders")
      .insert({
        clinic_id: ctx.clinic_id,
        created_by: ctx.user_id,
        lab_id,
        ...fields,
        sent_date: appt.date,
        status: "draft",
      })
      .select("id")
      .single();
    if (created) {
      await supabase.from("appointments_work").update({ lab_order_id: created.id }).eq("id", appt.id);
    }
  } catch (err) {
    // La atención ya quedó guardada; la orden se puede crear a mano en Laboratorio.
    console.warn("syncLabOrder error:", err);
  }
}

/**
 * Registra una atención. En General y Ortodoncia se pueden enviar varios
 * tratamientos de la misma visita (campo "items", JSON): se crea una atención
 * por tratamiento y el abono inicial se reparte en orden.
 */
export async function createAppointment(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = appointmentSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };
    const d = parsed.data;

    // Tratamientos de la visita (1 o varios)
    let items: z.infer<typeof cartItemSchema>[] = [
      { treatment_id: d.treatment_id || null, description: d.description, amount: d.amount },
    ];
    if (typeof raw.items === "string" && raw.items.trim()) {
      const list = z.array(cartItemSchema).min(1, "Agrega al menos un tratamiento").safeParse(JSON.parse(raw.items));
      if (!list.success) return { error: list.error.errors[0].message };
      items = list.data;
    }

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    let remainingPaid = Math.min(d.paid_amount, total);
    if (remainingPaid > 0 && !d.payment_method) {
      return { error: "Indica el medio de pago del abono inicial" };
    }

    const { supabase, clinic_id, user_id } = await getClinicId();

    const { data: cat } = await supabase
      .from("cash_categories")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("type", "income")
      .limit(1)
      .maybeSingle();

    for (const [index, item] of items.entries()) {
      const paid_amount = Math.min(remainingPaid, item.amount);
      remainingPaid -= paid_amount;
      // Laboratorio e insumos se asignan al primer tratamiento de la visita
      const lab_cost = index === 0 ? d.lab_cost : 0;
      const supplies_cost = index === 0 ? d.supplies_cost : 0;

      const { data: appt, error: apptError } = await supabase
        .from("appointments_work")
        .insert({
          clinic_id,
          created_by: user_id,
          date: d.date,
          patient_id: d.patient_id,
          dentist_id: d.dentist_id,
          treatment_id: item.treatment_id || null,
          description: item.description.trim(),
          amount: item.amount,
          paid_amount,
          payment_status: statusFor(item.amount, paid_amount),
          category: d.category,
          lab_cost,
          supplies_cost,
          dentist_pay_mode: d.dentist_pay_mode || null,
          dentist_pct: d.dentist_pay_mode === "commission" ? d.dentist_pct ?? null : null,
          dentist_fixed: d.dentist_pay_mode === "fixed" ? d.dentist_fixed ?? null : null,
          crown_qty: d.category === "implant" ? d.crown_qty ?? null : null,
        })
        .select("id")
        .single();

      if (apptError) {
        return {
          error:
            index === 0
              ? apptError.message
              : `Se guardaron ${index} de ${items.length} tratamientos. Error en "${item.description}": ${apptError.message}`,
        };
      }

      if (paid_amount > 0 && d.payment_method) {
        await supabase.from("cash_movements").insert({
          clinic_id,
          created_by: user_id,
          date: d.date,
          type: "income",
          category_id: cat?.id || null,
          amount: paid_amount,
          payment_method: d.payment_method,
          description: `Abono inicial — ${item.description.trim()}`,
          appointment_id: appt.id,
        });
      }

      await syncLabOrder(supabase, { clinic_id, user_id }, {
        id: appt.id,
        lab_order_id: null,
        category: d.category,
        lab_cost,
        amount: item.amount,
        description: item.description.trim(),
        date: d.date,
        patient_id: d.patient_id,
        dentist_id: d.dentist_id,
        treatment_id: item.treatment_id || null,
      });
    }

    revalidatePath("/atenciones");
    revalidatePath("/caja");
    revalidatePath("/laboratorio");
    revalidatePath("/pacientes");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function registerAppointmentPayment(data: {
  appointment_id: string;
  amount: number;
  payment_method: string;
  date?: string;
}): Promise<{ error: string | null }> {
  try {
    if (data.amount <= 0) return { error: "El monto debe ser mayor a 0" };
    const payDate = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayCL();

    const { supabase, clinic_id, user_id } = await getClinicId();

    const { data: appt, error: findError } = await supabase
      .from("appointments_work")
      .select("id, amount, paid_amount, description, date")
      .eq("id", data.appointment_id)
      .single();

    if (findError || !appt) return { error: "Atención no encontrada" };

    const pending = appt.amount - appt.paid_amount;
    if (data.amount > pending) {
      return { error: `El abono supera el saldo pendiente (${pending.toLocaleString("es-CL")})` };
    }
    const newPaid = appt.paid_amount + data.amount;
    let payment_status: PaymentStatus = "partial";
    if (newPaid >= appt.amount) payment_status = "paid";

    // Actualizar atención
    const { error: updError } = await supabase
      .from("appointments_work")
      .update({
        paid_amount: newPaid,
        payment_status,
      })
      .eq("id", appt.id);

    if (updError) return { error: updError.message };

    // Registrar en caja
    const { data: cat } = await supabase
      .from("cash_categories")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("type", "income")
      .limit(1)
      .maybeSingle();

    await supabase.from("cash_movements").insert({
      clinic_id,
      created_by: user_id,
      date: payDate,
      type: "income",
      category_id: cat?.id || null,
      amount: data.amount,
      payment_method: data.payment_method,
      description: `Abono atención — ${appt.description}`,
      appointment_id: appt.id,
    });

    revalidatePath("/atenciones");
    revalidatePath("/caja");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const appointmentUpdateSchema = appointmentSchema.omit({ paid_amount: true, payment_method: true });

/**
 * Edita una atención ya registrada (datos, valor, costos y pago al dentista).
 * Los abonos NO se tocan aquí: se registran con "Abonar".
 */
export async function updateAppointment(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = appointmentUpdateSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase, clinic_id, user_id } = await getClinicId();

    const { data: appt, error: findError } = await supabase
      .from("appointments_work")
      .select("id, paid_amount, lab_order_id")
      .eq("id", id)
      .single();
    if (findError || !appt) return { error: "Atención no encontrada" };

    const amount = parsed.data.amount;
    if (amount < appt.paid_amount) {
      return {
        error: `El valor no puede ser menor a lo ya cobrado (${appt.paid_amount.toLocaleString("es-CL")})`,
      };
    }
    let payment_status: PaymentStatus = "pending";
    if (appt.paid_amount >= amount && amount > 0) payment_status = "paid";
    else if (appt.paid_amount > 0) payment_status = "partial";

    const { error } = await supabase
      .from("appointments_work")
      .update({
        date: parsed.data.date,
        patient_id: parsed.data.patient_id,
        dentist_id: parsed.data.dentist_id,
        treatment_id: parsed.data.treatment_id || null,
        description: parsed.data.description.trim(),
        amount,
        payment_status,
        category: parsed.data.category,
        lab_cost: parsed.data.lab_cost,
        supplies_cost: parsed.data.supplies_cost,
        dentist_pay_mode: parsed.data.dentist_pay_mode || null,
        dentist_pct:
          parsed.data.dentist_pay_mode === "commission" ? parsed.data.dentist_pct ?? null : null,
        dentist_fixed:
          parsed.data.dentist_pay_mode === "fixed" ? parsed.data.dentist_fixed ?? null : null,
        crown_qty: parsed.data.category === "implant" ? parsed.data.crown_qty ?? null : null,
      })
      .eq("id", id);

    if (error) return { error: error.message };

    await syncLabOrder(supabase, { clinic_id, user_id }, {
      id,
      lab_order_id: appt.lab_order_id ?? null,
      category: parsed.data.category,
      lab_cost: parsed.data.lab_cost,
      amount,
      description: parsed.data.description.trim(),
      date: parsed.data.date,
      patient_id: parsed.data.patient_id,
      dentist_id: parsed.data.dentist_id,
      treatment_id: parsed.data.treatment_id || null,
    });

    revalidatePath("/atenciones");
    revalidatePath("/liquidaciones");
    revalidatePath("/laboratorio");
    revalidatePath("/pacientes");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function voidAppointment(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  try {
    if (!reason.trim()) return { error: "El motivo de anulación es obligatorio" };

    const { supabase } = await getClinicId();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("appointments_work")
      .update({
        voided_at: now,
        void_reason: reason.trim(),
      })
      .eq("id", id);

    if (error) return { error: error.message };

    // Anular movimientos asociados en caja
    await supabase
      .from("cash_movements")
      .update({
        voided_at: now,
        void_reason: `Anulación de atención asociada: ${reason.trim()}`,
      })
      .eq("appointment_id", id)
      .is("voided_at", null);

    // Anular la orden de laboratorio vinculada si aún no se le pagó al laboratorio
    const { data: appt } = await supabase
      .from("appointments_work")
      .select("lab_order_id")
      .eq("id", id)
      .maybeSingle();
    if (appt?.lab_order_id) {
      await supabase
        .from("lab_orders")
        .update({ voided_at: now, void_reason: `Atención anulada: ${reason.trim()}` })
        .eq("id", appt.lab_order_id)
        .eq("lab_paid", false)
        .is("voided_at", null);
    }

    revalidatePath("/atenciones");
    revalidatePath("/caja");
    revalidatePath("/laboratorio");
    revalidatePath("/pacientes");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Anula un abono mal registrado: el movimiento de caja queda anulado (con motivo)
 * y se descuenta de lo cobrado en la atención. Luego se puede registrar el abono correcto.
 */
export async function voidAppointmentPayment(
  movement_id: string,
  reason: string
): Promise<{ error: string | null }> {
  try {
    if (!reason.trim()) return { error: "El motivo es obligatorio" };
    const { supabase } = await getClinicId();

    const { data: mov, error: movError } = await supabase
      .from("cash_movements")
      .select("id, amount, appointment_id, voided_at, type")
      .eq("id", movement_id)
      .single();
    if (movError || !mov) return { error: "Abono no encontrado" };
    if (mov.voided_at) return { error: "Este abono ya estaba anulado" };
    if (!mov.appointment_id || mov.type !== "income") return { error: "El movimiento no es un abono de atención" };

    const { data: appt } = await supabase
      .from("appointments_work")
      .select("id, amount, paid_amount")
      .eq("id", mov.appointment_id)
      .single();
    if (!appt) return { error: "Atención no encontrada" };

    const { error: voidError } = await supabase
      .from("cash_movements")
      .update({ voided_at: new Date().toISOString(), void_reason: `Abono anulado: ${reason.trim()}` })
      .eq("id", mov.id);
    if (voidError) return { error: voidError.message };

    const newPaid = Math.max(0, appt.paid_amount - mov.amount);
    const { error } = await supabase
      .from("appointments_work")
      .update({ paid_amount: newPaid, payment_status: statusFor(appt.amount, newPaid) })
      .eq("id", appt.id);
    if (error) return { error: error.message };

    revalidatePath("/atenciones");
    revalidatePath("/caja");
    revalidatePath("/pacientes");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
