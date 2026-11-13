import { cache } from "react";
import { createClient } from "./server";

/**
 * Usuario y clínica de la sesión actual.
 * Con `cache` se consulta UNA sola vez por carga de página, aunque varias
 * funciones lo pidan (antes cada consulta repetía 2 viajes a Supabase).
 */
export const getClinicId = cache(async () => {
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
});
