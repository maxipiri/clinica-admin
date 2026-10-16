import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Clínica Admin",
    template: "%s | Clínica Admin",
  },
  description: "Sistema de administración para clínica dental",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          {/* Sidebar — solo desktop */}
          <Sidebar />

          {/* Contenido principal */}
          <main className="flex-1 flex flex-col min-h-screen">
            <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
              {children}
            </div>
          </main>
        </div>

        {/* Tab bar — solo móvil */}
        <BottomNav />
      </body>
    </html>
  );
}
