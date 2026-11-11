"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Wrench,
  XCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Building2,
  History,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { formatCLP } from "@/lib/utils";
import { CATEGORIES, CATEGORY_COLOR } from "@/app/atenciones/categories";
import type { TreatmentCategory } from "@/app/actions/atenciones";
import {
  createLab,
  createLabOrder,
  updateOrderStatus,
  voidLabOrder,
  payLabMonth,
  registerLabStep,
} from "@/app/actions/laboratorio";
import type {
  Lab,
  LabOrder,
  LabOrderEvent,
  LabBillingSummary,
  LabStatus,
} from "@/app/actions/laboratorio";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LabStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: "Borrador",  color: "lab-status--draft",     icon: <Clock className="w-3.5 h-3.5" /> },
  sent:      { label: "Enviada",   color: "lab-status--sent",      icon: <Package className="w-3.5 h-3.5" /> },
  received:  { label: "Recibida",  color: "lab-status--received",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  installed: { label: "Instalada", color: "lab-status--installed", icon: <Wrench className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelada", color: "lab-status--cancelled", icon: <XCircle className="w-3.5 h-3.5" /> },
};

/**
 * Etapas de una prótesis: cada una es una ida (clínica → laboratorio)
 * o una vuelta (laboratorio → clínica). El orden sugiere el siguiente paso.
 */
type StepDirection = "sent" | "received" | "installed" | "other";
const STEPS: { key: string; direction: StepDirection; label: string }[] = [
  { key: "modelo", direction: "sent", label: "Enviado: modelo (para rodete)" },
  { key: "rodete", direction: "received", label: "Recibido: rodete para prueba" },
  { key: "enfilado", direction: "sent", label: "Enviado: para enfilado" },
  { key: "prueba_enfilado", direction: "received", label: "Recibido: enfilado para prueba" },
  { key: "terminacion", direction: "sent", label: "Enviado: para terminación" },
  { key: "terminada", direction: "received", label: "Recibido: prótesis terminada" },
  { key: "instalada", direction: "installed", label: "Instalada en el paciente" },
  { key: "reenvio", direction: "sent", label: "Otro envío al laboratorio (ajuste / reparación)" },
  { key: "recepcion", direction: "received", label: "Otra recepción del laboratorio" },
];
const STEP_LABEL: Record<string, string> = Object.fromEntries(STEPS.map((st) => [st.key, st.label]));

/** Siguiente paso sugerido según el último movimiento registrado. */
function nextStepKey(events: LabOrderEvent[]): string {
  const withStage = events.filter((e) => e.stage);
  const last = withStage[withStage.length - 1];
  if (!last) return "modelo";
  const i = STEPS.findIndex((st) => st.key === last.stage);
  if (i >= 0 && i < 6) return STEPS[i + 1].key;
  if (last.direction === "sent") return "recepcion";
  if (last.direction === "received") return "reenvio";
  return "reenvio";
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo", transfer: "Transferencia",
  debit: "Débito", credit: "Crédito", other: "Otro",
};

function formatMonth(iso: string) {
  const [y, m] = iso.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Modal: Nuevo laboratorio ─────────────────────────────────────────────────

function NewLabModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createLab(fd);
      if (result.error) setError(result.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="lab-modal-title">Nuevo laboratorio</h2>
        <form onSubmit={handleSubmit} className="lab-form">
          {error && <p className="lab-form-error">{error}</p>}
          <div className="lab-field">
            <label htmlFor="lab-name" className="lab-label">Nombre *</label>
            <input id="lab-name" name="name" type="text" className="lab-input" placeholder="Lab. Dental Ejemplo" required maxLength={120} />
          </div>
          <div className="lab-field">
            <label htmlFor="lab-contact" className="lab-label">Contacto</label>
            <input id="lab-contact" name="contact" type="text" className="lab-input" placeholder="Nombre del contacto" maxLength={120} />
          </div>
          <div className="lab-field">
            <label htmlFor="lab-phone" className="lab-label">Teléfono</label>
            <input id="lab-phone" name="phone" type="tel" className="lab-input" placeholder="+56 9 1234 5678" maxLength={30} />
          </div>
          <div className="lab-field">
            <label htmlFor="lab-email" className="lab-label">Email</label>
            <input id="lab-email" name="email" type="email" className="lab-input" placeholder="lab@ejemplo.cl" />
          </div>
          <div className="lab-form-actions">
            <button type="button" className="lab-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lab-btn-primary" disabled={isPending}>
              {isPending ? <span className="lab-spinner" /> : "Crear laboratorio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Nueva orden ───────────────────────────────────────────────────────

function NewOrderModal({ labs, onClose }: { labs: Lab[]; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.substring(0, 7);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createLabOrder(fd);
      if (result.error) setError(result.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal lab-modal--lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="lab-modal-title">Nueva orden de laboratorio</h2>
        <form onSubmit={handleSubmit} className="lab-form">
          {error && <p className="lab-form-error">{error}</p>}

          <div className="lab-form-grid">
            <div className="lab-field">
              <label htmlFor="ord-lab" className="lab-label">Laboratorio *</label>
              <select id="ord-lab" name="lab_id" className="lab-input" required>
                <option value="">Seleccionar...</option>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="lab-field">
              <label htmlFor="ord-worktype" className="lab-label">Tipo de trabajo *</label>
              <input id="ord-worktype" name="work_type" type="text" className="lab-input" placeholder="Ej: Corona metal-cerámica" required maxLength={120} />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-patient" className="lab-label">Paciente *</label>
              <input id="ord-patient" name="patient_name" type="text" className="lab-input" placeholder="Nombre del paciente" required maxLength={120} />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-dentist" className="lab-label">Dentista *</label>
              <input id="ord-dentist" name="dentist_name" type="text" className="lab-input" placeholder="Nombre del dentista" required maxLength={120} />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-sent" className="lab-label">Fecha envío *</label>
              <input id="ord-sent" name="sent_date" type="date" className="lab-input" defaultValue={today} required />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-due" className="lab-label">Fecha entrega comprometida</label>
              <input id="ord-due" name="due_date" type="date" className="lab-input" />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-labcost" className="lab-label">Costo laboratorio (CLP)</label>
              <input id="ord-labcost" name="lab_cost" type="number" min="0" step="1" className="lab-input" defaultValue={0} />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-charged" className="lab-label">Cobro al paciente (CLP)</label>
              <input id="ord-charged" name="charged_to_patient" type="number" min="0" step="1" className="lab-input" defaultValue={0} />
            </div>
            <div className="lab-field">
              <label htmlFor="ord-month" className="lab-label">Mes de facturación</label>
              <input id="ord-month" name="billing_month" type="month" className="lab-input" defaultValue={currentMonth} />
            </div>
          </div>

          <div className="lab-field">
            <label htmlFor="ord-desc" className="lab-label">Descripción / notas</label>
            <textarea id="ord-desc" name="description" className="lab-input" rows={2} placeholder="Detalle del trabajo, color, indicaciones..." maxLength={500} />
          </div>

          <div className="lab-form-actions">
            <button type="button" className="lab-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lab-btn-primary" disabled={isPending}>
              {isPending ? <span className="lab-spinner" /> : "Crear orden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Registrar movimiento (ida / vuelta) ───────────────────────────────

function StepModal({ order, onClose }: { order: LabOrder; onClose: () => void }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const [stepKey, setStepKey] = useState(nextStepKey(order.events ?? []));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const step = STEPS.find((st) => st.key === stepKey)!;
  const needsNote = stepKey === "reenvio" || stepKey === "recepcion";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (needsNote && !note.trim()) {
      setError("Escribe un detalle (ej: ajuste de oclusión)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerLabStep({
        order_id: order.id,
        stage: stepKey,
        direction: step.direction,
        event_date: date,
        note,
      });
      if (result.error) setError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal lab-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="lab-modal-title">Registrar movimiento</h2>
        <p className="lab-modal-subtitle">
          {order.work_type} — {order.patient_name}
          {order.lab_name ? ` · ${order.lab_name}` : ""}
        </p>
        <form onSubmit={handleSubmit} className="lab-form">
          {error && <p className="lab-form-error">{error}</p>}
          <div className="space-y-1.5">
            {STEPS.map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStepKey(st.key)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  st.key === stepKey
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {st.direction === "sent" ? (
                  <ArrowRight className="w-4 h-4 text-sky-600 shrink-0" />
                ) : st.direction === "received" ? (
                  <ArrowLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Wrench className="w-4 h-4 text-violet-600 shrink-0" />
                )}
                {st.label}
              </button>
            ))}
          </div>
          <div className="lab-field">
            <label htmlFor="step-date" className="lab-label">
              Fecha en que {step.direction === "sent" ? "se envió" : step.direction === "received" ? "llegó" : "se instaló"}
            </label>
            <input
              id="step-date"
              type="date"
              className="lab-input"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="lab-field">
            <label htmlFor="step-note" className="lab-label">Detalle {needsNote ? "*" : "(opcional)"}</label>
            <input
              id="step-note"
              className="lab-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: cambiar color de dientes, ajustar oclusión..."
            />
          </div>
          <div className="lab-form-actions">
            <button type="button" className="lab-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lab-btn-primary" disabled={isPending}>
              {isPending ? <span className="lab-spinner" /> : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Cambiar estado ────────────────────────────────────────────────────

function StatusModal({ order, onClose }: { order: LabOrder; onClose: () => void }) {
  const [status, setStatus] = useState<LabStatus>(order.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("status", status);
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, fd);
      if (result.error) setError(result.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal lab-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="lab-modal-title">Cambiar estado</h2>
        <p className="lab-modal-subtitle">{order.work_type} — {order.patient_name}</p>
        <form onSubmit={handleSubmit} className="lab-form">
          {error && <p className="lab-form-error">{error}</p>}
          <div className="lab-status-selector">
            {(Object.keys(STATUS_CONFIG) as LabStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`lab-status-option ${s === status ? "lab-status-option--active" : ""}`}
                onClick={() => setStatus(s)}
              >
                {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          {status === "received" && (
            <div className="lab-field">
              <label htmlFor="recv-date" className="lab-label">Fecha de recepción</label>
              <input id="recv-date" name="received_date" type="date" className="lab-input" defaultValue={order.received_date ?? today} />
            </div>
          )}
          {status === "installed" && (
            <div className="lab-field">
              <label htmlFor="inst-date" className="lab-label">Fecha de instalación</label>
              <input id="inst-date" name="installed_date" type="date" className="lab-input" defaultValue={order.installed_date ?? today} />
            </div>
          )}
          <div className="lab-form-actions">
            <button type="button" className="lab-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lab-btn-primary" disabled={isPending}>
              {isPending ? <span className="lab-spinner" /> : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Pagar laboratorio ─────────────────────────────────────────────────

function PayLabModal({
  summary,
  onClose,
}: {
  summary: LabBillingSummary;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await payLabMonth({
        lab_id: summary.lab_id,
        month: summary.month,
        total: summary.total,
        method: fd.get("method") as string,
        notes: fd.get("notes") as string || undefined,
      });
      if (result.error) setError(result.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal lab-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="lab-modal-title">Registrar pago</h2>
        <div className="lab-pay-info">
          <p className="lab-pay-lab">{summary.lab_name}</p>
          <p className="lab-pay-month">{formatMonth(summary.month)}</p>
          <p className="lab-pay-total">{formatCLP(summary.total)}</p>
          <p className="lab-pay-orders">{summary.orders.length} orden(es)</p>
        </div>
        <form onSubmit={handleSubmit} className="lab-form">
          {error && <p className="lab-form-error">{error}</p>}
          <div className="lab-field">
            <label htmlFor="pay-method" className="lab-label">Medio de pago</label>
            <select id="pay-method" name="method" className="lab-input" required>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="lab-field">
            <label htmlFor="pay-notes" className="lab-label">Observaciones (opcional)</label>
            <input id="pay-notes" name="notes" type="text" className="lab-input" placeholder="N° transferencia, etc." />
          </div>
          <p className="lab-info">Se creará automáticamente un egreso en Caja.</p>
          <div className="lab-form-actions">
            <button type="button" className="lab-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lab-btn-primary" disabled={isPending}>
              {isPending ? <span className="lab-spinner" /> : `Pagar ${formatCLP(summary.total)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de orden ─────────────────────────────────────────────────────────

/** "10 nov 2026, 17:05" en hora de Chile */
function fechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(iso));
}

function OrderCard({
  order,
  onStatusClick,
  onStepClick,
  onVoidClick,
}: {
  order: LabOrder;
  onStatusClick: (o: LabOrder) => void;
  onStepClick: (o: LabOrder) => void;
  onVoidClick: (o: LabOrder) => void;
}) {
  const cfg = STATUS_CONFIG[order.status];
  const [showHistory, setShowHistory] = useState(false);
  const events = order.events ?? [];
  const lastStep = [...events].reverse().find((e) => e.stage);
  const catKey: TreatmentCategory = order.category ?? "general";
  const color = CATEGORY_COLOR[catKey];
  const cat = CATEGORIES.find((c) => c.key === catKey)!;
  const CatIcon = cat.icon;
  return (
    <div
      className={`lab-order-card ${order.is_overdue ? "lab-order-card--overdue" : ""}`}
      style={{ background: color.bg, borderColor: order.is_overdue ? undefined : color.border, borderLeft: `6px solid ${color.main}` }}
    >
      <div className="lab-order-header">
        <div className="lab-order-info">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ background: color.main }}
          >
            <CatIcon className="w-3 h-3" /> {cat.label}
          </span>
          <span className={`lab-status-badge ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          {order.is_overdue && (
            <span className="lab-overdue-badge">
              <AlertTriangle className="w-3 h-3" /> Atrasada
            </span>
          )}
        </div>
        <div className="lab-order-actions">
          {!["installed","cancelled"].includes(order.status) && (
            <button className="lab-icon-btn" onClick={() => onStepClick(order)} title="Registrar movimiento (envío / recepción)">
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          {!["installed","cancelled"].includes(order.status) && (
            <button className="lab-icon-btn" onClick={() => onStatusClick(order)} title="Cambiar estado">
              <Wrench className="w-4 h-4" />
            </button>
          )}
          <button className="lab-icon-btn lab-icon-btn--danger" onClick={() => onVoidClick(order)} title="Anular orden">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="lab-order-title">{order.work_type}</p>
      {lastStep && (
        <p className="text-xs font-semibold text-primary mt-0.5">
          Etapa: {STEP_LABEL[lastStep.stage!] ?? lastStep.stage}
          {lastStep.event_date ? ` · ${isoToDisplay(lastStep.event_date)}` : ""}
        </p>
      )}
      <div className="lab-order-meta">
        <span>👤 {order.patient_name}</span>
        <span>🦷 {order.dentist_name}</span>
        {order.lab_name && <span>🏭 {order.lab_name}</span>}
      </div>

      <div className="lab-order-dates">
        <span>Envío: {isoToDisplay(order.sent_date)}</span>
        {order.due_date && (
          <span className={order.is_overdue ? "text-rose-600 font-semibold" : ""}>
            Entrega: {isoToDisplay(order.due_date)}
          </span>
        )}
        {order.received_date && <span>Recibido: {isoToDisplay(order.received_date)}</span>}
        {order.installed_date && <span>Instalado: {isoToDisplay(order.installed_date)}</span>}
      </div>

      <div className="lab-order-costs">
        <span>Costo lab: <strong>{formatCLP(order.lab_cost)}</strong></span>
        <span>Cobro pac.: <strong>{formatCLP(order.charged_to_patient)}</strong></span>
        {order.billing_month && (
          <span>
            Fact.: {formatMonth(order.billing_month)}
            {order.lab_paid && <span className="lab-paid-badge">Pagado</span>}
          </span>
        )}
      </div>

      {events.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Historial de estados ({events.length})
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <ol className="mt-2 space-y-1.5 text-xs">
              {[...events].reverse().map((e) =>
                e.stage ? (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-muted-foreground tabular-nums">
                      {e.event_date ? isoToDisplay(e.event_date) : fechaHora(e.created_at)}
                    </span>
                    <span
                      className={`font-semibold ${
                        e.direction === "sent" ? "text-sky-700" : e.direction === "received" ? "text-emerald-700" : "text-violet-700"
                      }`}
                    >
                      {e.direction === "sent" ? "→ " : e.direction === "received" ? "← " : ""}
                      {STEP_LABEL[e.stage] ?? e.stage}
                    </span>
                    {e.note && <span className="text-muted-foreground italic">· {e.note}</span>}
                    <span className="text-muted-foreground/70 text-[10px]">
                      (anotado {fechaHora(e.created_at)}{e.changed_by_name ? ` por ${e.changed_by_name}` : ""})
                    </span>
                  </li>
                ) : (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground tabular-nums">{fechaHora(e.created_at)}</span>
                  <span className="font-semibold text-foreground">
                    {e.from_status
                      ? `${STATUS_CONFIG[e.from_status]?.label ?? e.from_status} → ${STATUS_CONFIG[e.to_status]?.label ?? e.to_status}`
                      : e.note
                      ? STATUS_CONFIG[e.to_status]?.label ?? e.to_status
                      : `Creada como ${STATUS_CONFIG[e.to_status]?.label ?? e.to_status}`}
                  </span>
                  {e.changed_by_name && <span className="text-muted-foreground">· {e.changed_by_name}</span>}
                  {e.note && <span className="text-muted-foreground italic">· {e.note}</span>}
                </li>
                )
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sección de cuentas por pagar ─────────────────────────────────────────────

function BillingSummarySection({
  summaries,
}: {
  summaries: LabBillingSummary[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<LabBillingSummary | null>(null);
  const router = useRouter();

  function closePayModal() {
    setPayTarget(null);
    router.refresh();
  }

  if (summaries.length === 0) {
    return (
      <div className="lab-empty-billing">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        <p>No hay cuentas por pagar pendientes.</p>
      </div>
    );
  }

  return (
    <div className="lab-billing-list">
      {summaries.map((s) => {
        const key = `${s.lab_id}__${s.month}`;
        const isExpanded = expanded === key;
        return (
          <div key={key} className="lab-billing-card">
            <div className="lab-billing-header" onClick={() => setExpanded(isExpanded ? null : key)}>
              <div>
                <p className="lab-billing-lab">{s.lab_name}</p>
                <p className="lab-billing-month">{formatMonth(s.month)}</p>
              </div>
              <div className="lab-billing-right">
                <p className="lab-billing-total">{formatCLP(s.total)}</p>
                <span className="lab-billing-count">{s.orders.length} ords.</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
            {isExpanded && (
              <div className="lab-billing-detail">
                {s.orders.map((o) => (
                  <div key={o.id} className="lab-billing-order-row">
                    <span className="text-sm">{o.work_type} — {o.patient_name}</span>
                    <span className="text-sm font-semibold">{formatCLP(o.lab_cost)}</span>
                  </div>
                ))}
                <div className="lab-billing-total-row">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">{formatCLP(s.total)}</span>
                </div>
                <button
                  id={`btn-pagar-lab-${s.lab_id}`}
                  className="lab-btn-primary lab-btn-full"
                  onClick={() => setPayTarget(s)}
                >
                  <CreditCard className="w-4 h-4" /> Registrar pago
                </button>
              </div>
            )}
          </div>
        );
      })}
      {payTarget && <PayLabModal summary={payTarget} onClose={closePayModal} />}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = "orders" | "billing" | "labs";
type Modal = "newLab" | "newOrder" | "status" | "step" | "void" | null;

export function LaboratorioClient({
  labs = [],
  orders = [],
  billingSummaries = [],
  overdueCount = 0,
}: {
  labs?: Lab[];
  orders?: LabOrder[];
  billingSummaries?: LabBillingSummary[];
  overdueCount?: number;
}) {
  const router = useRouter();
  const safeLabs = labs ?? [];
  const safeOrders = orders ?? [];
  const safeBillingSummaries = billingSummaries ?? [];
  const safeOverdueCount = overdueCount ?? 0;

  const [tab, setTab] = useState<Tab>("orders");
  const [modal, setModal] = useState<Modal>(null);
  const [catFilter, setCatFilter] = useState<TreatmentCategory | "all">("all");
  const visibleOrders =
    catFilter === "all" ? safeOrders : safeOrders.filter((o) => (o.category ?? "general") === catFilter);
  const [statusTarget, setStatusTarget] = useState<LabOrder | null>(null);
  const [voidTarget, setVoidTarget] = useState<LabOrder | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeModal() {
    setModal(null);
    setStatusTarget(null);
    setVoidTarget(null);
    setVoidReason("");
    setVoidError(null);
    router.refresh();
  }

  function handleVoidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!voidTarget) return;
    setVoidError(null);
    startTransition(async () => {
      const result = await voidLabOrder(voidTarget.id, voidReason);
      if (result.error) setVoidError(result.error);
      else closeModal();
    });
  }

  const pendingPayments = safeBillingSummaries.reduce((s, b) => s + (b?.total ?? 0), 0);

  return (
    <div className="lab-container">
      {/* ── Métricas rápidas ──────────────────────────────────────── */}
      <div className="lab-metrics">
        <div className="lab-metric">
          <p className="lab-metric-label">Órdenes activas</p>
          <p className="lab-metric-value">{safeOrders.filter((o) => !["installed","cancelled"].includes(o?.status)).length}</p>
        </div>
        <div className={`lab-metric ${safeOverdueCount > 0 ? "lab-metric--danger" : ""}`}>
          <p className="lab-metric-label">Atrasadas</p>
          <p className="lab-metric-value">{safeOverdueCount}</p>
        </div>
        <div className="lab-metric">
          <p className="lab-metric-label">Por pagar</p>
          <p className="lab-metric-value lab-metric-value--money">{formatCLP(pendingPayments)}</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="lab-tabs">
        <button id="tab-ordenes" className={`lab-tab ${tab === "orders" ? "lab-tab--active" : ""}`} onClick={() => setTab("orders")}>
          <Package className="w-4 h-4" /> Órdenes
        </button>
        <button id="tab-cuentas" className={`lab-tab ${tab === "billing" ? "lab-tab--active" : ""}`} onClick={() => setTab("billing")}>
          <CreditCard className="w-4 h-4" />
          Cuentas por pagar
          {billingSummaries.length > 0 && <span className="lab-tab-badge">{billingSummaries.length}</span>}
        </button>
        <button id="tab-laboratorios" className={`lab-tab ${tab === "labs" ? "lab-tab--active" : ""}`} onClick={() => setTab("labs")}>
          <Building2 className="w-4 h-4" /> Laboratorios
        </button>
      </div>

      {/* ── Acciones ──────────────────────────────────────────────── */}
      <div className="lab-actions">
        {tab === "orders" && (
          <button id="btn-nueva-orden" className="lab-btn-primary" onClick={() => setModal("newOrder")} disabled={safeLabs.length === 0}>
            <PlusCircle className="w-4 h-4" /> Nueva orden
          </button>
        )}
        {tab === "labs" && (
          <button id="btn-nuevo-lab" className="lab-btn-primary" onClick={() => setModal("newLab")}>
            <PlusCircle className="w-4 h-4" /> Nuevo laboratorio
          </button>
        )}
        {tab === "orders" && safeLabs.length === 0 && (
          <p className="lab-hint">Primero debes crear al menos un laboratorio.</p>
        )}
      </div>

      {/* ── Contenido por tab ─────────────────────────────────────── */}
      {tab === "orders" && safeOrders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setCatFilter("all")}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${catFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground"}`}
          >
            Todas ({safeOrders.length})
          </button>
          {CATEGORIES.filter((c) => safeOrders.some((o) => (o.category ?? "general") === c.key)).map((c) => {
            const col = CATEGORY_COLOR[c.key];
            const active = catFilter === c.key;
            const n = safeOrders.filter((o) => (o.category ?? "general") === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setCatFilter(active ? "all" : c.key)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
                style={active ? { background: col.main, borderColor: col.main, color: "white" } : { background: col.bg, borderColor: col.border, color: col.main }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: active ? "white" : col.main }} />
                {c.plural} ({n})
              </button>
            );
          })}
        </div>
      )}

      {tab === "orders" && (
        <div className="lab-orders-grid">
          {visibleOrders.length === 0 ? (
            <div className="lab-empty">
              <FlaskConical className="w-10 h-10 text-muted-foreground" />
              <p>Sin órdenes registradas.</p>
              {safeLabs.length > 0 && (
                <button className="lab-btn-primary" onClick={() => setModal("newOrder")}>
                  <PlusCircle className="w-4 h-4" /> Primera orden
                </button>
              )}
            </div>
          ) : (
            visibleOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onStatusClick={(ord) => { setStatusTarget(ord); setModal("status"); }}
                onStepClick={(ord) => { setStatusTarget(ord); setModal("step"); }}
                onVoidClick={(ord) => { setVoidTarget(ord); setModal("void"); }}
              />
            ))
          )}
        </div>
      )}

      {tab === "billing" && (
        <BillingSummarySection summaries={safeBillingSummaries} />
      )}

      {tab === "labs" && (
        <div className="lab-labs-list">
          {safeLabs.length === 0 ? (
            <div className="lab-empty">
              <Building2 className="w-10 h-10 text-muted-foreground" />
              <p>Sin laboratorios registrados.</p>
              <button className="lab-btn-primary" onClick={() => setModal("newLab")}>
                <PlusCircle className="w-4 h-4" /> Crear primero
              </button>
            </div>
          ) : (
            safeLabs.map((lab) => (
              <div key={lab.id} className="lab-lab-card">
                <div className="lab-lab-icon"><Building2 className="w-5 h-5" /></div>
                <div className="lab-lab-info">
                  <p className="lab-lab-name">{lab.name}</p>
                  {lab.contact && <p className="lab-lab-meta">👤 {lab.contact}</p>}
                  {lab.phone && <p className="lab-lab-meta">📱 {lab.phone}</p>}
                  {lab.email && <p className="lab-lab-meta">✉️ {lab.email}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modales ───────────────────────────────────────────────── */}
      {modal === "newLab" && <NewLabModal onClose={closeModal} />}
      {modal === "newOrder" && <NewOrderModal labs={safeLabs} onClose={closeModal} />}
      {modal === "status" && statusTarget && (
        <StatusModal order={statusTarget} onClose={closeModal} />
      )}
      {modal === "step" && statusTarget && (
        <StepModal order={statusTarget} onClose={closeModal} />
      )}
      {modal === "void" && voidTarget && (
        <div className="lab-modal-overlay" onClick={closeModal}>
          <div className="lab-modal lab-modal--sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="lab-modal-title">Anular orden</h2>
            <p className="lab-modal-subtitle">{voidTarget.work_type} — {voidTarget.patient_name}</p>
            <p className="lab-warning">
              <AlertTriangle className="w-4 h-4" />
              Esta acción no se puede deshacer.
            </p>
            <form onSubmit={handleVoidSubmit} className="lab-form">
              {voidError && <p className="lab-form-error">{voidError}</p>}
              <div className="lab-field">
                <label htmlFor="ord-void-reason" className="lab-label">Motivo</label>
                <input id="ord-void-reason" type="text" className="lab-input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} required placeholder="Pedido cancelado, duplicado..." />
              </div>
              <div className="lab-form-actions">
                <button type="button" className="lab-btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="lab-btn-danger" disabled={isPending}>
                  {isPending ? <span className="lab-spinner" /> : "Anular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .lab-container { display: flex; flex-direction: column; gap: 1rem; }

        /* Métricas */
        .lab-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        .lab-metric { background: white; border: 1px solid hsl(var(--border)); border-radius: 0.75rem; padding: 0.875rem 1rem; }
        .lab-metric--danger { border-color: hsl(0 84% 60% / 0.3); background: hsl(0 84% 60% / 0.04); }
        .lab-metric--danger .lab-metric-value { color: hsl(0 72% 42%); }
        .lab-metric-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.25rem; }
        .lab-metric-value { font-size: 1.25rem; font-weight: 700; color: hsl(var(--foreground)); }
        .lab-metric-value--money { font-size: 1rem; color: hsl(196 80% 32%); }

        /* Tabs */
        .lab-tabs { display: flex; gap: 0; border-bottom: 1px solid hsl(var(--border)); }
        .lab-tab { display: flex; align-items: center; gap: 0.375rem; padding: 0.625rem 1rem; border: none; background: transparent; font-size: 0.875rem; font-weight: 500; color: hsl(var(--muted-foreground)); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
        .lab-tab:hover { color: hsl(var(--foreground)); }
        .lab-tab--active { color: hsl(196 80% 35%); border-bottom-color: hsl(196 80% 38%); }
        .lab-tab-badge { font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.4rem; background: hsl(0 84% 60%); color: white; border-radius: 9999px; }

        /* Acciones */
        .lab-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .lab-hint { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); }

        /* Botones */
        .lab-btn-primary { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; background: hsl(196 80% 38%); color: white; border: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; box-shadow: 0 2px 8px hsl(196 80% 38% / 0.3); }
        .lab-btn-primary:hover:not(:disabled) { background: hsl(196 80% 32%); transform: translateY(-1px); }
        .lab-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .lab-btn-full { width: 100%; justify-content: center; }
        .lab-btn-secondary { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; background: hsl(var(--secondary)); color: hsl(var(--foreground)); border: 1px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s; }
        .lab-btn-secondary:hover { background: hsl(var(--accent)); }
        .lab-btn-danger { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; background: hsl(0 84% 60%); color: white; border: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
        .lab-btn-danger:hover:not(:disabled) { background: hsl(0 72% 50%); }
        .lab-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .lab-icon-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: transparent; cursor: pointer; color: hsl(var(--muted-foreground)); transition: all 0.15s; }
        .lab-icon-btn:hover { background: hsl(var(--secondary)); color: hsl(var(--foreground)); }
        .lab-icon-btn--danger:hover { background: hsl(0 84% 60% / 0.1); color: hsl(0 72% 42%); border-color: hsl(0 84% 60% / 0.3); }
        .lab-spinner { width: 16px; height: 16px; border: 2px solid hsl(0 0% 100% / 0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Órdenes grid */
        .lab-orders-grid { display: grid; gap: 0.75rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .lab-orders-grid { grid-template-columns: repeat(2, 1fr); } }

        /* Order card */
        .lab-order-card { background: white; border: 1px solid hsl(var(--border)); border-radius: 0.875rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; transition: box-shadow 0.15s; }
        .lab-order-card:hover { box-shadow: 0 4px 12px hsl(0 0% 0% / 0.07); }
        .lab-order-card--overdue { border-color: hsl(0 84% 60% / 0.35); background: hsl(0 84% 60% / 0.02); }
        .lab-order-header { display: flex; align-items: center; justify-content: space-between; }
        .lab-order-info { display: flex; align-items: center; gap: 0.375rem; }
        .lab-order-actions { display: flex; gap: 0.375rem; }
        .lab-order-title { font-size: 0.9375rem; font-weight: 600; color: hsl(var(--foreground)); }
        .lab-order-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: hsl(var(--muted-foreground)); }
        .lab-order-dates { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: hsl(var(--muted-foreground)); }
        .lab-order-costs { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: hsl(var(--muted-foreground)); border-top: 1px solid hsl(var(--border)); padding-top: 0.5rem; margin-top: 0.25rem; }

        /* Status badges */
        .lab-status-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px; }
        .lab-status--draft     { background: hsl(215 16% 90%); color: hsl(215 16% 35%); }
        .lab-status--sent      { background: hsl(196 80% 38% / 0.12); color: hsl(196 80% 30%); }
        .lab-status--received  { background: hsl(220 80% 55% / 0.12); color: hsl(220 80% 38%); }
        .lab-status--installed { background: hsl(142 76% 36% / 0.12); color: hsl(142 76% 28%); }
        .lab-status--cancelled { background: hsl(0 0% 88%); color: hsl(0 0% 40%); }
        .lab-overdue-badge { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px; background: hsl(0 84% 60% / 0.12); color: hsl(0 72% 42%); }
        .lab-paid-badge { margin-left: 0.25rem; font-size: 0.65rem; padding: 0.1rem 0.35rem; background: hsl(142 76% 36% / 0.12); color: hsl(142 76% 28%); border-radius: 9999px; }

        /* Status selector */
        .lab-status-selector { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.875rem; }
        .lab-status-option { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.75rem; border: 1.5px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.8125rem; cursor: pointer; background: transparent; color: hsl(var(--muted-foreground)); transition: all 0.15s; }
        .lab-status-option--active { border-color: hsl(196 80% 38%); background: hsl(196 80% 38% / 0.1); color: hsl(196 80% 30%); font-weight: 600; }

        /* Billing */
        .lab-billing-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .lab-billing-card { background: white; border: 1px solid hsl(var(--border)); border-radius: 0.875rem; overflow: hidden; }
        .lab-billing-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; cursor: pointer; transition: background 0.15s; }
        .lab-billing-header:hover { background: hsl(var(--secondary)); }
        .lab-billing-lab { font-size: 0.9375rem; font-weight: 600; color: hsl(var(--foreground)); }
        .lab-billing-month { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); margin-top: 0.125rem; }
        .lab-billing-right { display: flex; align-items: center; gap: 0.625rem; }
        .lab-billing-total { font-size: 1rem; font-weight: 700; color: hsl(196 80% 32%); }
        .lab-billing-count { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
        .lab-billing-detail { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid hsl(var(--border)); padding-top: 0.75rem; }
        .lab-billing-order-row { display: flex; justify-content: space-between; align-items: center; color: hsl(var(--muted-foreground)); }
        .lab-billing-total-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid hsl(var(--border)); padding-top: 0.5rem; color: hsl(var(--foreground)); }
        .lab-empty-billing { display: flex; flex-direction: column; align-items: center; gap: 0.625rem; padding: 3rem 1rem; color: hsl(var(--muted-foreground)); text-align: center; }

        /* Labs list */
        .lab-labs-list { display: flex; flex-direction: column; gap: 0.625rem; }
        .lab-lab-card { display: flex; align-items: flex-start; gap: 0.875rem; background: white; border: 1px solid hsl(var(--border)); border-radius: 0.75rem; padding: 0.875rem 1rem; }
        .lab-lab-icon { width: 36px; height: 36px; background: hsl(196 80% 38% / 0.1); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: hsl(196 80% 35%); flex-shrink: 0; }
        .lab-lab-name { font-size: 0.9375rem; font-weight: 600; color: hsl(var(--foreground)); }
        .lab-lab-meta { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); margin-top: 0.125rem; }

        /* Pay modal */
        .lab-pay-info { background: hsl(196 80% 38% / 0.06); border: 1px solid hsl(196 80% 38% / 0.15); border-radius: 0.75rem; padding: 1rem; margin-bottom: 1rem; }
        .lab-pay-lab { font-size: 1rem; font-weight: 700; color: hsl(var(--foreground)); }
        .lab-pay-month { font-size: 0.875rem; color: hsl(var(--muted-foreground)); }
        .lab-pay-total { font-size: 1.5rem; font-weight: 800; color: hsl(196 80% 32%); margin-top: 0.25rem; }
        .lab-pay-orders { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); }

        /* Modal */
        .lab-modal-overlay { position: fixed; inset: 0; z-index: 100; background: hsl(0 0% 0% / 0.45); backdrop-filter: blur(2px); display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s ease; }
        @media (min-width: 640px) { .lab-modal-overlay { align-items: center; padding: 1rem; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .lab-modal { width: 100%; max-width: 560px; max-height: 90dvh; overflow-y: auto; background: white; border-radius: 1rem 1rem 0 0; padding: 1.5rem; animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @media (min-width: 640px) { .lab-modal { border-radius: 1rem; max-height: 85dvh; } }
        .lab-modal--sm { max-width: 420px; }
        .lab-modal--lg { max-width: 640px; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .lab-modal-title { font-size: 1.125rem; font-weight: 700; margin: 0 0 1rem; color: hsl(var(--foreground)); }
        .lab-modal-subtitle { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.75rem; margin-top: -0.5rem; }

        /* Form */
        .lab-form { display: flex; flex-direction: column; gap: 0.875rem; }
        .lab-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        @media (max-width: 480px) { .lab-form-grid { grid-template-columns: 1fr; } }
        .lab-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .lab-label { font-size: 0.875rem; font-weight: 500; color: hsl(222 47% 20%); }
        .lab-input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.9375rem; color: hsl(var(--foreground)); background: hsl(var(--secondary) / 0.5); outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
        .lab-input:focus { border-color: hsl(196 80% 38%); box-shadow: 0 0 0 3px hsl(196 80% 38% / 0.12); background: white; }
        .lab-form-error { font-size: 0.8125rem; color: hsl(0 72% 42%); background: hsl(0 84% 60% / 0.08); padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid hsl(0 84% 60% / 0.2); }
        .lab-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.25rem; }

        /* Misc */
        .lab-empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem 1rem; color: hsl(var(--muted-foreground)); text-align: center; }
        .lab-warning { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: hsl(38 92% 40%); background: hsl(38 92% 50% / 0.08); border: 1px solid hsl(38 92% 50% / 0.2); border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; }
        .lab-info { font-size: 0.8125rem; color: hsl(196 80% 35%); background: hsl(196 80% 38% / 0.08); border: 1px solid hsl(196 80% 38% / 0.2); border-radius: 0.5rem; padding: 0.5rem 0.75rem; }
      `}</style>
    </div>
  );
}
