import type { Metadata } from "next";
import {
  LayoutDashboard,
  UserRound,
  Users,
  ClipboardList,
  FlaskConical,
  Wallet,
  Receipt,
  BarChart3,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

const modulos = [
  {
    href: "/dentistas",
    label: "Dentistas",
    descripcion: "Gestiona el equipo de profesionales",
    icon: UserRound,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/pacientes",
    label: "Pacientes",
    descripcion: "Registro de pacientes y datos de contacto",
    icon: Users,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    href: "/atenciones",
    label: "Atenciones",
    descripcion: "Tratamientos realizados y pagos",
    icon: ClipboardList,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/laboratorio",
    label: "Laboratorio",
    descripcion: "Órdenes de prótesis y cuentas por pagar",
    icon: FlaskConical,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    href: "/caja",
    label: "Caja",
    descripcion: "Ingresos, egresos y cierre diario",
    icon: Wallet,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/liquidaciones",
    label: "Liquidaciones",
    descripcion: "Comisiones mensuales de dentistas",
    icon: Receipt,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    href: "/reportes",
    label: "Reportes",
    descripcion: "Análisis y exportación de datos",
    icon: BarChart3,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" />
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bienvenido al sistema de administración de la clínica.
        </p>
      </div>

      {/* Banner de configuración (se elimina en Fase 1 cuando haya auth) */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Fase 0 completa.</strong> Para continuar, configura las
        variables de entorno de Supabase en{" "}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">
          .env.local
        </code>{" "}
        e importa el repositorio en Vercel.
      </div>

      {/* Grid de módulos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {modulos.map(({ href, label, descripcion, icon: Icon, color, bg }) => (
          <a
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow flex flex-col gap-3"
          >
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {descripcion}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
