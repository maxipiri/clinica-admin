import { redirect } from "next/navigation";

/**
 * Raíz del sitio: redirige a /dashboard.
 * En Fase 1 se cambiará a redirigir a /login si no hay sesión.
 */
export default function HomePage() {
  redirect("/dashboard");
}
