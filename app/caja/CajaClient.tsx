"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  XCircle,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { formatCLP } from "@/lib/utils";
import {
  createMovement,
  voidMovement,
  saveCashClosing,
  initDefaultCategories,
} from "@/app/actions/caja";
import type {
  CashCategory,
  CashMovement,
  DaySummary,
  PaymentMethod,
  MovementType,
} from "@/app/actions/caja";

// ─── Helpers UI ──────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  debit: "Débito",
  credit: "Crédito",
  other: "Otro",
};

const STATUS_COLORS: Record<string, string> = {
  income: "text-emerald-600",
  expense: "text-rose-600",
};

function dateToISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function isoToDisplay(iso: string) {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return dateToISO(d);
}

function todayISO() {
  return dateToISO(new Date());
}

// ─── Formulario de movimiento ─────────────────────────────────────────────────

function MovementForm({
  date,
  categories,
  onClose,
}: {
  date: string;
  categories: CashCategory[];
  onClose: () => void;
}) {
  const [type, setType] = useState<MovementType>("income");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = categories.filter((c) => c.type === type);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);
    fd.set("type", type);
    setError(null);
    startTransition(async () => {
      const result = await createMovement(fd);
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="caja-modal-overlay" onClick={onClose}>
      <div className="caja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="caja-modal-header">
          <h2 className="caja-modal-title">Nuevo movimiento</h2>
          <span className="caja-modal-date">{isoToDisplay(date)}</span>
        </div>

        {/* Selector tipo */}
        <div className="caja-type-tabs">
          <button
            type="button"
            className={`caja-type-tab ${type === "income" ? "caja-type-tab--income" : ""}`}
            onClick={() => setType("income")}
          >
            <TrendingUp className="w-4 h-4" /> Ingreso
          </button>
          <button
            type="button"
            className={`caja-type-tab ${type === "expense" ? "caja-type-tab--expense" : ""}`}
            onClick={() => setType("expense")}
          >
            <TrendingDown className="w-4 h-4" /> Egreso
          </button>
        </div>

        <form onSubmit={handleSubmit} className="caja-form">
          {error && <p className="caja-form-error">{error}</p>}

          <div className="caja-field">
            <label htmlFor="mov-amount" className="caja-label">Monto (CLP)</label>
            <input
              id="mov-amount"
              name="amount"
              type="number"
              min="1"
              step="1"
              placeholder="10000"
              className="caja-input"
              required
            />
          </div>

          <div className="caja-field">
            <label htmlFor="mov-desc" className="caja-label">Descripción</label>
            <input
              id="mov-desc"
              name="description"
              type="text"
              placeholder="Ej: Compra guantes desechables"
              className="caja-input"
              maxLength={255}
              required
            />
          </div>

          <div className="caja-field">
            <label htmlFor="mov-cat" className="caja-label">Categoría</label>
            <select id="mov-cat" name="category_id" className="caja-input">
              <option value="">Sin categoría</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="caja-field">
            <label htmlFor="mov-method" className="caja-label">Medio de pago</label>
            <select id="mov-method" name="payment_method" className="caja-input" required>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="caja-form-actions">
            <button type="button" className="caja-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="caja-btn-primary" disabled={isPending}>
              {isPending ? <span className="caja-spinner" /> : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de anulación ───────────────────────────────────────────────────────

function VoidModal({
  movement,
  onClose,
}: {
  movement: CashMovement;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await voidMovement(movement.id, reason);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="caja-modal-overlay" onClick={onClose}>
      <div className="caja-modal caja-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="caja-modal-header">
          <h2 className="caja-modal-title">Anular movimiento</h2>
        </div>
        <p className="caja-modal-subtitle">
          <strong>{movement.description}</strong> — {formatCLP(movement.amount)}
        </p>
        <p className="caja-warning">
          <AlertTriangle className="w-4 h-4" />
          Esta acción no se puede deshacer. El movimiento quedará anulado.
        </p>
        <form onSubmit={handleSubmit} className="caja-form">
          {error && <p className="caja-form-error">{error}</p>}
          <div className="caja-field">
            <label htmlFor="void-reason" className="caja-label">Motivo de anulación</label>
            <input
              id="void-reason"
              type="text"
              className="caja-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Error de digitación, duplicado..."
              required
            />
          </div>
          <div className="caja-form-actions">
            <button type="button" className="caja-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="caja-btn-danger" disabled={isPending}>
              {isPending ? <span className="caja-spinner" /> : "Anular"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal cierre de caja ─────────────────────────────────────────────────────

function ClosingModal({
  date,
  summary,
  onClose,
}: {
  date: string;
  summary: DaySummary;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const expectedCash =
    (summary.by_method.cash?.income ?? 0) -
    (summary.by_method.cash?.expense ?? 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);
    setError(null);
    startTransition(async () => {
      const result = await saveCashClosing(fd);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="caja-modal-overlay" onClick={onClose}>
      <div className="caja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="caja-modal-header">
          <h2 className="caja-modal-title">Cierre de caja — {isoToDisplay(date)}</h2>
        </div>
        <div className="caja-closing-summary">
          <div className="caja-closing-row">
            <span>Efectivo esperado</span>
            <strong className={expectedCash >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatCLP(expectedCash)}
            </strong>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="caja-form">
          {error && <p className="caja-form-error">{error}</p>}
          <div className="caja-field">
            <label htmlFor="counted-cash" className="caja-label">Efectivo contado</label>
            <input
              id="counted-cash"
              name="counted_cash"
              type="number"
              min="0"
              step="1"
              defaultValue={summary.closing?.counted_cash ?? expectedCash}
              className="caja-input"
              required
            />
          </div>
          <div className="caja-field">
            <label htmlFor="closing-notes" className="caja-label">Observaciones (opcional)</label>
            <textarea
              id="closing-notes"
              name="notes"
              className="caja-input"
              rows={2}
              defaultValue={summary.closing?.notes ?? ""}
              placeholder="Diferencias, aclaraciones..."
            />
          </div>
          {summary.closing && (
            <p className="caja-info">Ya hay un cierre registrado. Se actualizará.</p>
          )}
          <div className="caja-form-actions">
            <button type="button" className="caja-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="caja-btn-primary" disabled={isPending}>
              {isPending ? <span className="caja-spinner" /> : "Guardar cierre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const defaultSummary: DaySummary = {
  total_income: 0,
  total_expense: 0,
  by_method: {
    cash: { income: 0, expense: 0 },
    transfer: { income: 0, expense: 0 },
    debit: { income: 0, expense: 0 },
    credit: { income: 0, expense: 0 },
    other: { income: 0, expense: 0 },
  },
  closing: null,
};

// ─── Componente principal ─────────────────────────────────────────────────────

type Modal = "movement" | "void" | "closing" | null;

export function CajaClient({
  initialDate,
  movements = [],
  summary = defaultSummary,
  categories = [],
}: {
  initialDate: string;
  movements?: CashMovement[];
  summary?: DaySummary;
  categories?: CashCategory[];
}) {
  const router = useRouter();
  const safeMovements = movements ?? [];
  const safeSummary = summary ?? defaultSummary;
  const safeCategories = categories ?? [];

  const [date, setDate] = useState(initialDate);
  const [modal, setModal] = useState<Modal>(null);
  const [voidTarget, setVoidTarget] = useState<CashMovement | null>(null);
  const [isInit, startInit] = useTransition();

  const isToday = date === todayISO();
  const hasClosed = !!safeSummary.closing;

  function navigate(days: number) {
    const newDate = addDays(date, days);
    router.push(`/caja?fecha=${newDate}`);
  }

  function openVoid(m: CashMovement) {
    setVoidTarget(m);
    setModal("void");
  }

  function closeModal() {
    setModal(null);
    setVoidTarget(null);
    router.refresh();
  }

  function handleInitCategories() {
    startInit(async () => {
      await initDefaultCategories();
      router.refresh();
    });
  }

  const netBalance = (safeSummary.total_income ?? 0) - (safeSummary.total_expense ?? 0);

  return (
    <div className="caja-container">
      {/* ── Navegación de fecha ─────────────────────────────────── */}
      <div className="caja-date-nav">
        <button
          id="prev-day"
          className="caja-nav-btn"
          onClick={() => navigate(-1)}
          aria-label="Día anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="caja-date-display">
          <span className="caja-date-text">{isoToDisplay(date)}</span>
          {isToday && <span className="caja-badge caja-badge--today">Hoy</span>}
          {hasClosed && <span className="caja-badge caja-badge--closed"><Lock className="w-3 h-3" />Cerrada</span>}
        </div>
        <button
          id="next-day"
          className="caja-nav-btn"
          onClick={() => navigate(1)}
          disabled={isToday}
          aria-label="Día siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Resumen ─────────────────────────────────────────────── */}
      <div className="caja-summary">
        <div className="caja-summary-card caja-summary-card--income">
          <TrendingUp className="w-5 h-5" />
          <div>
            <p className="caja-summary-label">Ingresos</p>
            <p className="caja-summary-amount">{formatCLP(safeSummary.total_income ?? 0)}</p>
          </div>
        </div>
        <div className="caja-summary-card caja-summary-card--expense">
          <TrendingDown className="w-5 h-5" />
          <div>
            <p className="caja-summary-label">Egresos</p>
            <p className="caja-summary-amount">{formatCLP(safeSummary.total_expense ?? 0)}</p>
          </div>
        </div>
        <div className={`caja-summary-card caja-summary-card--balance ${netBalance >= 0 ? "caja-summary-card--positive" : "caja-summary-card--negative"}`}>
          <div>
            <p className="caja-summary-label">Balance neto</p>
            <p className="caja-summary-amount">{formatCLP(netBalance)}</p>
          </div>
        </div>
      </div>

      {/* ── Acciones ────────────────────────────────────────────── */}
      <div className="caja-actions">
        {safeCategories.length === 0 && (
          <button className="caja-btn-secondary" onClick={handleInitCategories} disabled={isInit}>
            {isInit ? <span className="caja-spinner" /> : "Inicializar categorías"}
          </button>
        )}
        <button id="btn-nuevo-movimiento" className="caja-btn-primary" onClick={() => setModal("movement")}>
          <PlusCircle className="w-4 h-4" /> Nuevo movimiento
        </button>
        <button id="btn-cierre-caja" className="caja-btn-outline" onClick={() => setModal("closing")}>
          <Lock className="w-4 h-4" /> {hasClosed ? "Ver cierre" : "Cerrar caja"}
        </button>
      </div>

      {/* ── Cierre existente ────────────────────────────────────── */}
      {safeSummary.closing && (
        <div className={`caja-closing-banner ${safeSummary.closing.difference === 0 ? "caja-closing-banner--ok" : "caja-closing-banner--diff"}`}>
          <Lock className="w-4 h-4" />
          <span>
            Cierre registrado · Contado: <strong>{formatCLP(safeSummary.closing.counted_cash)}</strong>
            {" · "}Diferencia:{" "}
            <strong className={safeSummary.closing.difference === 0 ? "text-emerald-700" : "text-rose-700"}>
              {safeSummary.closing.difference > 0 ? "+" : ""}{formatCLP(safeSummary.closing.difference)}
            </strong>
          </span>
        </div>
      )}

      {/* ── Lista de movimientos ─────────────────────────────────── */}
      <div className="caja-list">
        {safeMovements.length === 0 ? (
          <div className="caja-empty">
            <p>Sin movimientos para este día.</p>
            <button className="caja-btn-primary" onClick={() => setModal("movement")}>
              <PlusCircle className="w-4 h-4" /> Registrar primero
            </button>
          </div>
        ) : (
          safeMovements.map((m) => (
            <div key={m.id} className={`caja-movement ${m.voided_at ? "caja-movement--voided" : ""}`}>
              <div className="caja-movement-left">
                <div className={`caja-movement-indicator ${m.type === "income" ? "caja-indicator--income" : "caja-indicator--expense"}`} />
                <div>
                  <p className="caja-movement-desc">
                    {m.description}
                    {m.voided_at && <span className="caja-void-badge">Anulado</span>}
                  </p>
                  <p className="caja-movement-meta">
                    {m.category_name && <>{m.category_name} · </>}
                    {METHOD_LABELS[m.payment_method as PaymentMethod]}
                  </p>
                </div>
              </div>
              <div className="caja-movement-right">
                <span className={`caja-movement-amount ${STATUS_COLORS[m.type]}`}>
                  {m.type === "income" ? "+" : "−"}{formatCLP(m.amount)}
                </span>
                {!m.voided_at && (
                  <button
                    className="caja-void-btn"
                    onClick={() => openVoid(m)}
                    title="Anular movimiento"
                    aria-label={`Anular ${m.description}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modales ──────────────────────────────────────────────── */}
      {modal === "movement" && (
        <MovementForm date={date} categories={safeCategories} onClose={closeModal} />
      )}
      {modal === "void" && voidTarget && (
        <VoidModal movement={voidTarget} onClose={closeModal} />
      )}
      {modal === "closing" && (
        <ClosingModal date={date} summary={safeSummary} onClose={closeModal} />
      )}

      <style>{`
        .caja-container { display: flex; flex-direction: column; gap: 1rem; }

        /* Navegación fecha */
        .caja-date-nav {
          display: flex; align-items: center; gap: 0.75rem;
          background: white; border-radius: 0.75rem;
          border: 1px solid hsl(var(--border)); padding: 0.75rem 1rem;
        }
        .caja-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)); background: hsl(var(--secondary));
          cursor: pointer; transition: background 0.15s; color: hsl(var(--foreground));
        }
        .caja-nav-btn:hover:not(:disabled) { background: hsl(var(--accent)); }
        .caja-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .caja-date-display { flex: 1; display: flex; align-items: center; gap: 0.5rem; justify-content: center; }
        .caja-date-text { font-size: 1.125rem; font-weight: 700; color: hsl(var(--foreground)); }
        .caja-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px; }
        .caja-badge--today { background: hsl(196 80% 38% / 0.12); color: hsl(196 80% 30%); }
        .caja-badge--closed { background: hsl(215 16% 90%); color: hsl(215 16% 40%); }

        /* Resumen */
        .caja-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        @media (max-width: 480px) { .caja-summary { grid-template-columns: 1fr 1fr; } .caja-summary > :last-child { grid-column: 1 / -1; } }
        .caja-summary-card {
          border-radius: 0.75rem; padding: 0.875rem 1rem;
          display: flex; align-items: center; gap: 0.625rem;
          border: 1px solid transparent;
        }
        .caja-summary-card--income { background: hsl(142 76% 36% / 0.08); border-color: hsl(142 76% 36% / 0.2); color: hsl(142 76% 28%); }
        .caja-summary-card--expense { background: hsl(0 84% 60% / 0.08); border-color: hsl(0 84% 60% / 0.2); color: hsl(0 72% 42%); }
        .caja-summary-card--balance { border: 1px solid hsl(var(--border)); background: white; color: hsl(var(--foreground)); }
        .caja-summary-card--positive .caja-summary-amount { color: hsl(142 76% 28%); }
        .caja-summary-card--negative .caja-summary-amount { color: hsl(0 72% 42%); }
        .caja-summary-label { font-size: 0.75rem; opacity: 0.75; margin-bottom: 0.125rem; }
        .caja-summary-amount { font-size: 1rem; font-weight: 700; }

        /* Acciones */
        .caja-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

        /* Botones */
        .caja-btn-primary {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 1rem; background: hsl(196 80% 38%); color: white;
          border: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s, transform 0.1s;
          box-shadow: 0 2px 8px hsl(196 80% 38% / 0.3);
        }
        .caja-btn-primary:hover:not(:disabled) { background: hsl(196 80% 32%); transform: translateY(-1px); }
        .caja-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .caja-btn-secondary {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 1rem; background: hsl(var(--secondary)); color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500;
          cursor: pointer; transition: background 0.15s;
        }
        .caja-btn-secondary:hover { background: hsl(var(--accent)); }
        .caja-btn-outline {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 1rem; background: transparent;
          border: 1.5px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500;
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
          color: hsl(var(--foreground));
        }
        .caja-btn-outline:hover { border-color: hsl(196 80% 38%); background: hsl(196 80% 38% / 0.05); }
        .caja-btn-danger {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 1rem; background: hsl(0 84% 60%); color: white;
          border: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .caja-btn-danger:hover:not(:disabled) { background: hsl(0 72% 50%); }
        .caja-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .caja-spinner {
          width: 16px; height: 16px; border: 2px solid hsl(0 0% 100% / 0.35); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Banner cierre */
        .caja-closing-banner {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.625rem 1rem; border-radius: 0.625rem; font-size: 0.875rem;
        }
        .caja-closing-banner--ok { background: hsl(142 76% 36% / 0.08); color: hsl(142 76% 25%); border: 1px solid hsl(142 76% 36% / 0.2); }
        .caja-closing-banner--diff { background: hsl(0 84% 60% / 0.08); color: hsl(0 72% 38%); border: 1px solid hsl(0 84% 60% / 0.2); }

        /* Lista movimientos */
        .caja-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .caja-movement {
          display: flex; align-items: center; justify-content: space-between;
          background: white; border: 1px solid hsl(var(--border));
          border-radius: 0.75rem; padding: 0.75rem 1rem;
          transition: box-shadow 0.15s;
        }
        .caja-movement:hover { box-shadow: 0 2px 8px hsl(0 0% 0% / 0.06); }
        .caja-movement--voided { opacity: 0.5; }
        .caja-movement-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
        .caja-movement-indicator { width: 4px; height: 36px; border-radius: 9999px; flex-shrink: 0; }
        .caja-indicator--income { background: hsl(142 76% 36%); }
        .caja-indicator--expense { background: hsl(0 84% 60%); }
        .caja-movement-desc { font-size: 0.875rem; font-weight: 500; color: hsl(var(--foreground)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .caja-movement-meta { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 0.125rem; }
        .caja-movement-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .caja-movement-amount { font-size: 0.9375rem; font-weight: 700; }
        .caja-void-badge { font-size: 0.65rem; padding: 0.125rem 0.375rem; background: hsl(215 16% 88%); color: hsl(215 16% 40%); border-radius: 9999px; margin-left: 0.375rem; }
        .caja-void-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; color: hsl(215 16% 60%); border-radius: 0.375rem; transition: color 0.15s, background 0.15s; }
        .caja-void-btn:hover { color: hsl(0 84% 50%); background: hsl(0 84% 60% / 0.08); }

        .caja-empty { text-align: center; padding: 2.5rem 1rem; color: hsl(var(--muted-foreground)); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }

        /* Modal */
        .caja-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: hsl(0 0% 0% / 0.45); backdrop-filter: blur(2px);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          animation: fadeIn 0.15s ease;
        }
        @media (min-width: 640px) {
          .caja-modal-overlay { align-items: center; padding: 1rem; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .caja-modal {
          width: 100%; max-width: 480px; max-height: 90dvh; overflow-y: auto;
          background: white; border-radius: 1rem 1rem 0 0; padding: 1.5rem;
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 640px) {
          .caja-modal { border-radius: 1rem; max-height: 80dvh; }
        }
        .caja-modal--sm { max-width: 400px; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .caja-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .caja-modal-title { font-size: 1.125rem; font-weight: 700; color: hsl(var(--foreground)); margin: 0; }
        .caja-modal-date { font-size: 0.875rem; color: hsl(var(--muted-foreground)); }
        .caja-modal-subtitle { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.75rem; }

        /* Tipo tabs */
        .caja-type-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; background: hsl(var(--secondary)); border-radius: 0.625rem; padding: 0.25rem; margin-bottom: 1rem; }
        .caja-type-tab { display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.5rem; border: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; background: transparent; color: hsl(var(--muted-foreground)); transition: all 0.2s; }
        .caja-type-tab--income { background: white; color: hsl(142 76% 28%); box-shadow: 0 1px 3px hsl(0 0% 0% / 0.1); }
        .caja-type-tab--expense { background: white; color: hsl(0 72% 42%); box-shadow: 0 1px 3px hsl(0 0% 0% / 0.1); }

        /* Formulario */
        .caja-form { display: flex; flex-direction: column; gap: 0.875rem; }
        .caja-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .caja-label { font-size: 0.875rem; font-weight: 500; color: hsl(222 47% 20%); }
        .caja-input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid hsl(var(--border)); border-radius: 0.5rem; font-size: 0.9375rem; color: hsl(var(--foreground)); background: hsl(var(--secondary) / 0.5); outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
        .caja-input:focus { border-color: hsl(196 80% 38%); box-shadow: 0 0 0 3px hsl(196 80% 38% / 0.12); background: white; }
        .caja-form-error { font-size: 0.8125rem; color: hsl(0 72% 42%); background: hsl(0 84% 60% / 0.08); padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid hsl(0 84% 60% / 0.2); }
        .caja-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.25rem; }

        /* Cierre */
        .caja-closing-summary { background: hsl(var(--secondary)); border-radius: 0.625rem; padding: 0.75rem 1rem; margin-bottom: 1rem; }
        .caja-closing-row { display: flex; justify-content: space-between; font-size: 0.9375rem; }

        .caja-warning { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: hsl(38 92% 40%); background: hsl(38 92% 50% / 0.08); border: 1px solid hsl(38 92% 50% / 0.2); border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; }
        .caja-info { font-size: 0.8125rem; color: hsl(196 80% 35%); background: hsl(196 80% 38% / 0.08); border: 1px solid hsl(196 80% 38% / 0.2); border-radius: 0.5rem; padding: 0.5rem 0.75rem; }
      `}</style>
    </div>
  );
}
