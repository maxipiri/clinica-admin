"use server";

import { getClinicId } from "@/lib/supabase/clinic";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Patient = {
  id: string;
  full_name: string;
  rut: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

// ─── Validaciones ────────────────────────────────────────────────────────────

const patientSchema = z.object({
  full_name: z.string().min(1, "El nombre completo es obligatorio").max(120),
  rut: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

// ─── Helper ───────────────────────────────────────────────────────────────────


// ─── Consultas ───────────────────────────────────────────────────────────────

export async function getPatients(search?: string): Promise<Patient[]> {
  try {
    const { supabase } = await getClinicId();
    let q = supabase
      .from("patients")
      .select("id, full_name, rut, phone, email, notes, created_at")
      .order("full_name");

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      q = q.or(`full_name.ilike.${term},rut.ilike.${term},phone.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("getPatients warning:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("getPatients error:", err);
    return [];
  }
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export async function createPatient(
  formData: FormData
): Promise<{ error: string | null; id?: string }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = patientSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase, clinic_id } = await getClinicId();
    const { data, error } = await supabase
      .from("patients")
      .insert({
        clinic_id,
        full_name: parsed.data.full_name.trim(),
        rut: parsed.data.rut?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/pacientes");
    revalidatePath("/atenciones");
    return { error: null, id: data.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updatePatient(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const parsed = patientSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { supabase } = await getClinicId();
    const { error } = await supabase
      .from("patients")
      .update({
        full_name: parsed.data.full_name.trim(),
        rut: parsed.data.rut?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/pacientes");
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
