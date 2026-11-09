import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

/**
 * Layout exclusivo para rutas de autenticación (/login).
 * No hereda el Sidebar ni el BottomNav del layout raíz.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
