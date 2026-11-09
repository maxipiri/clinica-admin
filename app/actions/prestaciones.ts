"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { TreatmentItem } from "@/app/actions/atenciones";

// ─── Validaciones ────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  default_price: z.coerce.number().int().min(0, "Precio inválido"),
  lab_cost: z.coerce.number().int().min(0, "Costo laboratorio inválido").default(0),
  category: z.enum(["general", "prosthesis", "implant", "orthodontics"]),
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
  return { supabase, clinic_id: profile.clinic_id as string };
}

function revalidate() {
  revalidatePath("/prestaciones");
  revalidatePath("/atenciones");
}

// ─── Consultas ───────────────────────────────────────────────────────────────

/** Todo el catálogo, incluidas las prestaciones desactivadas. */
export async function getCatalogAll(): Promise<TreatmentItem[]> {
  try {
    const { supabase } = await getClinicId();
    const { data, error } = await supabase
      .from("treatments_catalog")
      .select("id, name, default_price, active, category, material, extension, lab_cost")
      .order("name");
    if (error) {
      console.warn("getCatalogAll warning:", error.message);
      return [];
    }
    return (data ?? []).map((t: any) => ({
      ...t,
      category: t.category ?? "general",
      lab_cost: t.lab_cost ?? 0,
    }));
  } catch (err) {
    console.warn("getCatalogAll error:", err);
    return [];
  }
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export async function createCatalogItem(data: {
  name: string;
  default_price: number;
  lab_cost?: number;
  category: string;
}): Promise<{ error: string | null }> {
  try {
    const parsed = itemSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.errors[0].message };
    const { supabase, clinic_id } = await getClinicId();

    const { data: dup } = await supabase
      .from("treatments_catalog")
      .select("id")
      .ilike("name", parsed.data.name)
      .maybeSingle();
    if (dup) return { error: "Ya existe una prestación con ese nombre" };

    const { error } = await supabase.from("treatments_catalog").insert({ clinic_id, ...parsed.data });
    if (error) return { error: error.message };
    revalidate();
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateCatalogItem(
  id: string,
  data: { name: string; default_price: number; lab_cost?: number; category: string }
): Promise<{ error: string | null }> {
  try {
    const parsed = itemSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.errors[0].message };
    const { supabase } = await getClinicId();
    const { error } = await supabase.from("treatments_catalog").update(parsed.data).eq("id", id);
    if (error) return { error: error.message };
    revalidate();
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Activa / desactiva (no se borra, porque puede estar usada en atenciones). */
export async function toggleCatalogItem(id: string, active: boolean): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getClinicId();
    const { error } = await supabase.from("treatments_catalog").update({ active }).eq("id", id);
    if (error) return { error: error.message };
    revalidate();
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
