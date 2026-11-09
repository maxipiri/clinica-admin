import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Users,
  Wallet,
  FlaskConical,
  Receipt,
  Tags,
  HandCoins,
  UserRound,
} from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import { getMonthSummary, getRecurringExpenses } from "@/app/actions/resumen";
import { CATEGORIES } from "@/app/atenciones/categories";
import { GastosFijosClient } from "./GastosFijosClient";

export const metadata: Metadata = {
  title: "Dashboard",
};

const accesos = [
  { href: "/atenciones", label: "Atenciones", icon: ClipboardList },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/cobranza", label: "Cobranza", icon: HandCoins },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/laboratorio", label: "Laboratorio", icon: FlaskConical },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
  { href: "/prestaciones", label: "Prestaciones", icon: Tags },
  { href: "/dentistas", label: "Dentistas", icon: UserRound },
];

function currentMonthCL() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(0, 7);
}
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonthCL();
  const [summary, recurring] = await Promise.all([getMonthSummary(month), getRecurringExpenses(month)]);
  const name = monthName(month);

  const lines = [
    { label: "Producción (atenciones realizadas)", value: summary.production, strong: false },
    { label: "Pago a dentistas", value: -summary.dentists || 0 },
    { label: "Laboratorio", value: -summary.lab || 0 },
    { label: "Insumos", value: -summary.supplies || 0 },
    { label: "Gastos del mes (caja)", value: -summary.expenses || 0 },
  ];
  const pendingRecurring = recurring.filter((r) => r.active && !r.loaded);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            Resultado del mes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Lo que realmente gana la clínica: producción menos dentistas, laboratorio, insumos y gastos.
          </p>
        </div>
        <div className="inline-flex items-center bg-card border border-border rounded-lg overflow-hidden self-start">
          <Link href={`/dashboard?mes=${shiftMonth(month, -1)}`} className="p-2 hover:bg-accent" aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="px-3 text-sm font-semibold min-w-36 text-center">{name}</span>
          <Link href={`/dashboard?mes=${shiftMonth(month, 1)}`} className="p-2 hover:bg-accent" aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Ganancia + cobrado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1 p-5 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ganancia real · {name}</p>
          <p className={cn("text-3xl font-extrabold mt-1", summary.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatCLP(summary.profit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{summary.appointments_count} atenciones en el mes</p>
          {pendingRecurring.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Faltan cargar {pendingRecurring.length} gasto(s) fijo(s); la ganancia real será menor.
            </p>
          )}
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entró a caja</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCLP(summary.collected)}</p>
          <p className="text-xs text-muted-foreground mt-1">Abonos y pagos recibidos en {name.toLowerCase()}</p>
        </div>
        <Link href="/cobranza" className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por cobrar de este mes</p>
          <p className={cn("text-2xl font-bold mt-1", summary.pending_from_month > 0 ? "text-rose-600" : "text-foreground")}>
            {formatCLP(summary.pending_from_month)}
          </p>
          <p className="text-xs text-primary mt-1 font-semibold">Ver lista de cobranza →</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="space-y-4">
          {/* Estado de resultado */}
          <div className="bg-card border border-border rounded-xl">
            <h2 className="px-4 py-3 font-bold text-foreground border-b border-border">Detalle del resultado</h2>
            <div className="px-4 py-3 space-y-1.5 text-sm">
              {lines.map((l) => (
                <div key={l.label} className="flex justify-between">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className={cn("font-mono", l.value < 0 ? "text-rose-600" : "text-foreground font-semibold")}>
                    {l.value < 0 ? `−${formatCLP(-l.value)}` : formatCLP(l.value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 mt-2 text-base font-bold">
                <span>Ganancia real</span>
                <span className={cn("font-mono", summary.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {formatCLP(summary.profit)}
                </span>
              </div>
            </div>
          </div>

          {/* Por categoría */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {summary.by_category.map((c) => {
              const meta = CATEGORIES.find((x) => x.key === c.category)!;
              return (
                <div key={c.category} className="p-4 bg-card border border-border rounded-xl">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                    <meta.icon className="w-4 h-4 text-primary" /> {meta.plural}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{c.count}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Producción</p>
                  <p className="font-mono font-semibold">{formatCLP(c.production)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ganancia clínica</p>
                  <p className={cn("font-mono font-semibold", c.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {formatCLP(c.profit)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Gastos por categoría */}
          <div className="bg-card border border-border rounded-xl">
            <h2 className="px-4 py-3 font-bold text-foreground border-b border-border flex justify-between">
              Gastos del mes <span className="font-mono">{formatCLP(summary.expenses)}</span>
            </h2>
            {summary.expenses_by_category.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Sin gastos registrados en {name.toLowerCase()}. Los gastos variables se anotan en{" "}
                <Link href="/caja" className="text-primary font-semibold hover:underline">
                  Caja
                </Link>{" "}
                como egreso.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {summary.expenses_by_category.map((e) => (
                  <div key={e.name} className="px-4 py-2 flex justify-between text-sm">
                    <span>{e.name}</span>
                    <span className="font-mono">{formatCLP(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <GastosFijosClient month={month} monthName={name} items={recurring} />

          <div className="grid grid-cols-2 gap-2">
            {accesos.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
