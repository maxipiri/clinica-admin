import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Raíz del sitio: redirige a /dashboard si hay sesión, o a /login si no.
 * El middleware también protege las rutas, esto es solo un shortcut.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
