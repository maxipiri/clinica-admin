"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  PlusCircle,
  CreditCard,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Pencil,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import {
  createAppointment,
  updateAppointment,
  registerAppointmentPayment,
  voidAppointment,
  voidAppointmentPayment,
} from "@/app/actions/atenciones";
import type {
  Appointment,
  AppointmentPayment,
  TreatmentItem,
  PaymentStatus,
  TreatmentCategory,
} from "@/app/actions/atenciones";
import type { Dentist } from "@/app/actions/dentistas";
import type { Patient } from "@/app/actions/pacientes";
import { NuevaAtencionModal } from "./NuevaAtencionModal";
import { CATEGORIES, GENERAL_CATEGORY, PAYMENT_METHOD_LABEL } from "./categories";

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pendiente",
    bg: "bg-rose-500/10 border-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  partial: {
    label: "Abono parcial",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  paid: {
    label: "Pagado",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

type ModalState =
  | { mode: "new"; category: TreatmentCategory }
  | { mode: "edit"; appt: Appointment }
  | null;

function totals(list: Appointment[]) {
  const billed = list.reduce((s, a) => s + a.amount, 0);
  const collected = list.reduce((s, a) => s + a.paid_amount, 0);
  return { billed, collected, pending: Math.max(0, billed - collected), count: list.length };
}

/** "mar 15 nov" a partir de "2026-11-15" (sin desfase de zona horaria). */
function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

const todayCL = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

/** "2026-11" ± n meses */
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EyeToggle({ hidden, onClick, className }: { hidden: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent", className)}
      title={hidden ? "Mostrar montos" : "Ocultar montos"}
      aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
    >
      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

export function AtencionesClient({
  appointments = [],
  dentists = [],
  patients = [],
  treatments = [],
}: {
  appointments?: Appointment[];
  dentists?: Dentist[];
  patients?: Patient[];
  treatments?: TreatmentItem[];
}) {
  const router = useRouter();
  const safeAppointments = appointments ?? [];
  const safeDentists = dentists ?? [];
  const safePatients = patients ?? [];
  const safeTreatments = treatments ?? [];

  const [filterDentist, setFilterDentist] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<TreatmentCategory | "all">("all");

  // Ojo para ocultar montos (como en las apps del banco). Se recuerda en este navegador.
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem("clinica-admin:montos-ocultos");
      if (saved) setHidden(JSON.parse(saved));
    } catch {
      /* sin almacenamiento disponible: se muestran todos */
    }
  }, []);
  function toggleHidden(key: string) {
    setHidden((h) => {
      const next = { ...h, [key]: !h[key] };
      try {
        localStorage.setItem("clinica-admin:montos-ocultos", JSON.stringify(next));
      } catch {
        /* ignorar */
      }
      return next;
    });
  }
  const money = (key: string, value: number) => (hidden[key] ? "$ ••••••" : formatCLP(value));
  const [month, setMonth] = useState<string>(todayCL().slice(0, 7));
  const [allMonths, setAllMonths] = useState(false);
  const [voidPay, setVoidPay] = useState<{ appt: Appointment; payment: AppointmentPayment } | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [paymentTarget, setPaymentTarget] = useState<Appointment | null>(null);
  const [voidTarget, setVoidTarget] = useState<Appointment | null>(null);
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCreate = safePatients.length > 0 && safeDentists.length > 0;

  // Filtros de dentista y estado aplican a todo; la categoría solo al listado
  const base = safeAppointments.filter((a) => {
    if (!allMonths && !a.date.startsWith(month)) return false;
    if (filterDentist !== "all" && a.dentist_id !== filterDentist) return false;
    if (filterStatus !== "all" && a.payment_status !== filterStatus) return false;
    return true;
  });
  const filtered = filterCategory === "all" ? base : base.filter((a) => a.category === filterCategory);
  const general = totals(base);

  function openNew(category: TreatmentCategory) {
    setError(null);
    setModal({ mode: "new", category });
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    const current = modal;

    startTransition(async () => {
      const res =
        current?.mode === "edit"
          ? await updateAppointment(current.appt.id, fd)
          : await createAppointment(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setModal(null);
        router.refresh();
      }
    });
  }

  function handleRegisterPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentTarget) return;
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const res = await registerAppointmentPayment({
        appointment_id: paymentTarget.id,
        amount: Number(fd.get("amount")),
        payment_method: fd.get("payment_method") as string,
        date: fd.get("date") as string,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpenHistory((h) => ({ ...h, [paymentTarget.id]: true }));
        setPaymentTarget(null);
        router.refresh();
      }
    });
  }

  function handleVoidPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voidPay) return;
    const reason = (new FormData(e.currentTarget).get("reason") as string) ?? "";
    setError(null);
    startTransition(async () => {
      const res = await voidAppointmentPayment(voidPay.payment.id, reason);
      if (res.error) setError(res.error);
      else {
        setVoidPay(null);
        router.refresh();
      }
    });
  }

  function handleVoid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voidTarget) return;
    const fd = new FormData(e.currentTarget);
    const reason = fd.get("reason") as string;
    setError(null);

    startTransition(async () => {
      const res = await voidAppointment(voidTarget.id, reason);
      if (res.error) {
        setError(res.error);
      } else {
        setVoidTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Mes */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center bg-card border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setAllMonths(false);
              setMonth((m) => shiftMonth(m, -1));
            }}
            className="p-2 hover:bg-accent"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={cn("px-3 text-sm font-semibold min-w-36 text-center", allMonths && "text-muted-foreground")}>
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => {
              setAllMonths(false);
              setMonth((m) => shiftMonth(m, 1));
            }}
            className="p-2 hover:bg-accent"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {month !== todayCL().slice(0, 7) && !allMonths && (
          <button
            type="button"
            onClick={() => setMonth(todayCL().slice(0, 7))}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Volver al mes actual
          </button>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
          <input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
          Ver todos los meses
        </label>
      </div>

      {/* Total general */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total general · todas las categorías · {allMonths ? "todos los meses" : monthLabel(month)} ({general.count} atenciones)
          </p>
          <EyeToggle hidden={!!hidden.total} onClick={() => toggleHidden("total")} className="-mt-1 -mr-1" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div>
            <p className="text-xs text-muted-foreground">Total realizado</p>
            <p className="text-lg sm:text-xl font-bold text-foreground">{money("total", general.billed)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Efectivamente cobrado</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-600">{money("total", general.collected)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo por cobrar</p>
            <p className={cn("text-lg sm:text-xl font-bold", general.pending > 0 ? "text-rose-600" : "text-foreground")}>
              {money("total", general.pending)}
            </p>
          </div>
        </div>
      </div>

      {/* Cuadros por categoría */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {CATEGORIES.map(({ key, plural, newLabel, icon: Icon }) => {
          const t = totals(base.filter((a) => a.category === key));
          const active = filterCategory === key;
          return (
            <div
              key={key}
              className={cn(
                "relative bg-card border rounded-xl flex flex-col transition-shadow",
                active ? "border-primary ring-2 ring-primary/20" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => setFilterCategory(active ? "all" : key)}
                className="p-4 text-left flex-1 rounded-t-xl hover:bg-accent/50"
                title={active ? "Quitar filtro" : `Ver solo ${plural}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-foreground">
                    <Icon className="w-4 h-4 text-primary" />
                    {plural}
                  </span>
                  <span className="text-xs text-muted-foreground mr-8">{t.count}</span>
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold text-foreground">{money(key, t.billed)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cobrado</dt>
                    <dd className="font-semibold text-emerald-600">{money(key, t.collected)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Por cobrar</dt>
                    <dd className={cn("font-semibold", t.pending > 0 ? "text-rose-600" : "text-foreground")}>
                      {money(key, t.pending)}
                    </dd>
                  </div>
                </dl>
              </button>
              <EyeToggle
                hidden={!!hidden[key]}
                onClick={() => toggleHidden(key)}
                className="absolute top-3 right-3"
              />
              <button
                type="button"
                onClick={() => openNew(key)}
                disabled={!canCreate}
                className="m-3 mt-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-95 disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {newLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-lg">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={filterDentist}
            onChange={(e) => setFilterDentist(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground font-medium cursor-pointer"
          >
            <option value="all">Todos los dentistas</option>
            {safeDentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-lg">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground font-medium cursor-pointer"
          >
            <option value="all">Todos los estados de pago</option>
            <option value="pending">Pendientes</option>
            <option value="partial">Abonos parciales</option>
            <option value="paid">Pagados completos</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[{ key: "all" as const, plural: "Todas", icon: null }, ...CATEGORIES].map((c) => {
            const active = filterCategory === c.key;
            const count = c.key === "all" ? base.length : base.filter((a) => a.category === c.key).length;
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilterCategory(c.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:bg-accent"
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {c.plural}
                <span className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!canCreate && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Para registrar atenciones necesitas tener registrado al menos 1 paciente y 1 dentista.</span>
        </div>
      )}

      {/* Listado */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-card border border-border rounded-xl">
          <ClipboardList className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground text-base">Sin atenciones registradas</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            Usa los botones de cada categoría para registrar una atención.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const st = STATUS_CONFIG[a.payment_status];
            const pendingBalance = Math.max(0, a.amount - a.paid_amount);
            const cat = CATEGORIES.find((c) => c.key === a.category) ?? GENERAL_CATEGORY;
            const historyOpen = !!openHistory[a.id];
            const registered = a.payments.reduce((s, p) => s + p.amount, 0);
            const unregistered = Math.max(0, a.paid_amount - registered);

            return (
              <div key={a.id} className="bg-card border border-border rounded-xl">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {a.date}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        <cat.icon className="w-3 h-3" />
                        {cat.label}
                      </span>
                      <h4 className="font-bold text-foreground text-sm">{a.description}</h4>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.bg} ${st.text}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      <span>
                        Paciente:{" "}
                        <Link href={`/pacientes/${a.patient_id}`} className="font-bold text-foreground hover:text-primary hover:underline">
                          {a.patient_name}
                        </Link>
                      </span>
                      <span>Dentista: <strong className="text-foreground">{a.dentist_name}</strong></span>
                    </div>

                    {(a.category !== "general" || a.lab_cost > 0 || a.supplies_cost > 0) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {a.lab_cost > 0 && (
                          <span>
                            {a.category === "implant" && a.crown_qty
                              ? `Coronas (${a.crown_qty}): `
                              : "Lab: "}
                            {formatCLP(a.lab_cost)}
                          </span>
                        )}
                        {a.supplies_cost > 0 && <span>Insumos: {formatCLP(a.supplies_cost)}</span>}
                        <span>
                          {a.dentist_name}: {formatCLP(a.dentist_pay)}
                          {a.effective_pay_mode === "fixed" ? " (fijo)" : ""}
                        </span>
                        <span>
                          Ganancia clínica:{" "}
                          <strong className={a.clinic_profit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {formatCLP(a.clinic_profit)}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatCLP(a.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Cobrado: {formatCLP(a.paid_amount)}
                        {pendingBalance > 0 && (
                          <span className="text-rose-600 font-semibold block sm:inline sm:ml-1">
                            (Resta: {formatCLP(pendingBalance)})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {a.payment_status !== "paid" && (
                        <button
                          onClick={() => {
                            setError(null);
                            setPaymentTarget(a);
                          }}
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg inline-flex items-center gap-1.5 hover:opacity-90"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Abonar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setError(null);
                          setModal({ mode: "edit", appt: a });
                        }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                        title="Editar atención"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setVoidTarget(a);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-colors"
                        title="Anular atención"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Historial de abonos */}
                {a.paid_amount > 0 && (
                  <div className="border-t border-border">
                    <button
                      type="button"
                      onClick={() => setOpenHistory((h) => ({ ...h, [a.id]: !historyOpen }))}
                      className="w-full px-4 py-2 text-xs font-semibold text-muted-foreground flex items-center justify-between hover:bg-accent/50 rounded-b-xl"
                    >
                      <span>Historial de abonos ({a.payments.length})</span>
                      {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {historyOpen && (
                      <div className="px-4 pb-3 text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="text-muted-foreground text-left">
                              <th className="font-medium py-1">Fecha</th>
                              <th className="font-medium py-1">Medio</th>
                              <th className="font-medium py-1 text-right">Monto</th>
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {a.payments.map((p) => (
                              <tr key={p.id}>
                                <td className="py-1.5 capitalize">{fechaCorta(p.date)}</td>
                                <td className="py-1.5">{PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}</td>
                                <td className="py-1.5 text-right font-mono font-semibold">{formatCLP(p.amount)}</td>
                                <td className="py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setError(null);
                                      setVoidPay({ appt: a, payment: p });
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-accent"
                                    title="Anular este abono (si se registró mal)"
                                  >
                                    <Undo2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {unregistered > 0 && (
                              <tr>
                                <td className="py-1.5 text-muted-foreground" colSpan={2}>
                                  Abono sin fecha registrada (sin medio de pago)
                                </td>
                                <td className="py-1.5 text-right font-mono font-semibold">{formatCLP(unregistered)}</td>
                                <td />
                              </tr>
                            )}
                            <tr className="font-bold">
                              <td className="pt-2" colSpan={2}>Total abonado</td>
                              <td className="pt-2 text-right font-mono">{formatCLP(a.paid_amount)}</td>
                              <td />
                            </tr>
                            {pendingBalance > 0 && (
                              <tr className="font-bold text-rose-600">
                                <td colSpan={2}>Saldo pendiente</td>
                                <td className="text-right font-mono">{formatCLP(pendingBalance)}</td>
                                <td />
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva / Editar Atención */}
      {modal && (
        <NuevaAtencionModal
          key={modal.mode === "edit" ? `edit-${modal.appt.id}` : `new-${modal.category}`}
          dentists={safeDentists}
          patients={safePatients}
          treatments={safeTreatments}
          error={error}
          isPending={isPending}
          onSubmit={handleSave}
          onClose={() => setModal(null)}
          initialCategory={modal.mode === "new" ? modal.category : undefined}
          editing={modal.mode === "edit" ? modal.appt : null}
        />
      )}

      {/* Modal Registrar Abono */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-1">Registrar Abono</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {paymentTarget.patient_name} · {paymentTarget.description} — Saldo pendiente:{" "}
              <strong className="text-rose-600 font-semibold">
                {formatCLP(paymentTarget.amount - paymentTarget.paid_amount)}
              </strong>
            </p>

            <form onSubmit={handleRegisterPayment} className="space-y-4 text-sm">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-medium border border-rose-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Fecha del abono *</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={todayCL()}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Monto (CLP) *</label>
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    max={paymentTarget.amount - paymentTarget.paid_amount}
                    step="1"
                    defaultValue={paymentTarget.amount - paymentTarget.paid_amount}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Medio de pago *</label>
                <select
                  name="payment_method"
                  required
                  defaultValue="debit"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia bancaria</option>
                  <option value="debit">Tarjeta Débito</option>
                  <option value="credit">Tarjeta Crédito</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentTarget(null)}
                  className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:opacity-95 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : "Confirmar abono"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Anular abono */}
      {voidPay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-1">Anular abono</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {fechaCorta(voidPay.payment.date)} ·{" "}
              {PAYMENT_METHOD_LABEL[voidPay.payment.payment_method] ?? voidPay.payment.payment_method} ·{" "}
              <strong className="text-foreground">{formatCLP(voidPay.payment.amount)}</strong> de{" "}
              {voidPay.appt.patient_name}. Se anula en la caja y se descuenta de lo cobrado; después puedes registrar el
              abono correcto con &quot;Abonar&quot;.
            </p>
            <form onSubmit={handleVoidPayment} className="space-y-3 text-sm">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 text-xs border border-rose-200">
                  {error}
                </div>
              )}
              <input
                name="reason"
                required
                placeholder="Motivo (ej: monto mal digitado)"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidPay(null)}
                  className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {isPending ? "Anulando..." : "Anular abono"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Anular */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-1">Anular Atención</h3>
            <p className="text-xs text-muted-foreground mb-3">
              ¿Estás seguro de anular la atención &quot;{voidTarget.description}&quot;? Los ingresos asociados en caja también serán anulados.
              Si solo hay que corregir un dato, usa el lápiz para editarla.
            </p>

            <form onSubmit={handleVoid} className="space-y-4 text-sm">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 text-xs border border-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Motivo de la anulación *</label>
                <input
                  name="reason"
                  type="text"
                  required
                  placeholder="Ej: Paciente no se realizó el tratamiento"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {isPending ? "Anulando..." : "Confirmar anulación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
