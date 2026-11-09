"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Dentist = {
  id: string;
  full_name: string;
  rut: string | null;
  phone: string | null;
  email: string | null;
  commission_pct: number;
  commission_base: "gross" | "net";
  /** commission = % por atención; fixed = monto fijo por atención (ej. implantólogo) */
  pay_mode: "commission" | "fixed";
  fixed_fee: number | null;
  active: boolean;
  created_at: string;
};

// ─── Validaciones ────────────────────────────────────────────────────────────

const dentistSchema = z.object({
  full_name: z.string().min(1, "El nombre es obligatorio").max(120),
  rut: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  commission_pct: z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%"),
  commission_base: z.enum(["gross", "net"]),
  pay_mode: z.enum(["commission", "fixed"]).default("commission"),
  fixed_fee: z.coerce.number().int().min(0, "Monto fijo inválido").optional().or(z.literal("")),
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

export async function getDentists(onlyActive = false): Promise<Dentist[]> {
  try {
    const { supabase } = await getClinicId();
    let q = supabase
      .from("dentists")
      .select("id, full_name, rut, phone, email, commission_pct, commission_base, pay_mode, fixed_fee, active, created_at")
      .order("full_name");

    if (onlyActive) {
      q = q.eq("active", true);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("getDentists warning:", error.message);
      return [];
    }
    return (data ?? []).map((d: any) => ({
      ...d,
      commission_pct: Number(d.commission_pct),
      pay_mode: d.pay_mode ?? "commission",
      fixed_fee: d.fixed_fee ?? null,
    }));
  } catch (err) {
    console.warn("getDentists error:", err);
    return [];
  }
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export async function createDentist(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = dentistSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase, clinic_id } = await getClinicId();
    const { error } = await supabase.from("dentists").insert({
      clinic_id,
      full_name: parsed.data.full_name.trim(),
      rut: parsed.data.rut?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
      commission_pct: parsed.data.commission_pct,
      commission_base: parsed.data.commission_base,
      pay_mode: parsed.data.pay_mode,
      fixed_fee:
        parsed.data.pay_mode === "fixed" && parsed.data.fixed_fee !== "" && parsed.data.fixed_fee != null
          ? Number(parsed.data.fixed_fee)
          : null,
    });

    if (error) return { error: error.message };
    revalidatePath("/dentistas");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateDentist(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = dentistSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("dentists")
      .update({
        full_name: parsed.data.full_name.trim(),
        rut: parsed.data.rut?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        commission_pct: parsed.data.commission_pct,
        commission_base: parsed.data.commission_base,
        pay_mode: parsed.data.pay_mode,
        fixed_fee:
          parsed.data.pay_mode === "fixed" && parsed.data.fixed_fee !== "" && parsed.data.fixed_fee != null
            ? Number(parsed.data.fixed_fee)
            : null,
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/dentistas");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleDentistActive(
  id: string,
  active: boolean
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("dentists")
      .update({ active })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/dentistas");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
