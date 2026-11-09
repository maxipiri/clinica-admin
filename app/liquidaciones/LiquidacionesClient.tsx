"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Calculator,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { formatCLP } from "@/lib/utils";
import {
  calculateSettlementPreview,
  saveSettlementDraft,
  paySettlement,
} from "@/app/actions/liquidaciones";
import type {
  Settlement,
  SettlementPreview,
} from "@/app/actions/liquidaciones";
import type { Dentist } from "@/app/actions/dentistas";

export function LiquidacionesClient({
  settlements = [],
  dentists = [],
  currentMonth,
}: {
  settlements?: Settlement[];
  dentists?: Dentist[];
  currentMonth: string; // YYYY-MM
}) {
  const router = useRouter();
  const safeSettlements = settlements ?? [];
  const safeDentists = dentists ?? [];

  const [month, setMonth] = useState(currentMonth);
  const [selectedDentist, setSelectedDentist] = useState<string>(
    safeDentists[0]?.id ?? ""
  );

  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Settlement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Calcular previsualización
  function handleCalculate() {
    if (!selectedDentist) return;
    setError(null);

    startTransition(async () => {
      const res = await calculateSettlementPreview(selectedDentist, month);
      if (res.error) {
        setError(res.error);
        setPreview(null);
      } else {
        setPreview(res.data);
        setPreviewOpen(true);
      }
    });
  }

  // Guardar borrador
  function handleSaveDraft() {
    if (!selectedDentist) return;
    setError(null);

    startTransition(async () => {
      const res = await saveSettlementDraft({
        dentist_id: selectedDentist,
        monthStr: month,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setPreviewOpen(false);
        router.refresh();
      }
    });
  }

  // Pagar liquidación
  function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payTarget) return;
    const fd = new FormData(e.currentTarget);
    const method = fd.get("payment_method") as string;
    setError(null);

    startTransition(async () => {
      const res = await paySettlement({
        settlement_id: payTarget.id,
        payment_method: method,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setPayTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Calculadora / Generador de Liquidación */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground text-base">Generar Liquidación Mensual</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Mes de liquidación
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPreview(null);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Dentista
            </label>
            <select
              value={selectedDentist}
              onChange={(e) => {
                setSelectedDentist(e.target.value);
                setPreview(null);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
            >
              <option value="">Seleccionar dentista...</option>
              {safeDentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.commission_pct}% - {d.commission_base === "net" ? "Neto" : "Bruto"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={isPending || !selectedDentist}
              className="w-full py-2 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {isPending ? "Calculando..." : "Calcular Liquidación"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-medium border border-rose-200">
            {error}
          </div>
        )}

        {/* Desglose de cálculo (preview) */}
        {preview && (
          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h4 className="font-bold text-foreground text-sm">
                  Liquidación: {preview.dentist_name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Período: {preview.month.substring(0, 7)} · Base:{" "}
                  {preview.commission_base === "net" ? "Neta (descuenta laboratorio)" : "Bruta"} ·{" "}
                  {preview.pay_mode === "fixed"
                    ? `Pago fijo: ${formatCLP(preview.fixed_fee ?? 0)} por atención`
                    : `Comisión: ${preview.commission_pct}%`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Monto a Liquidar</span>
                <span className="text-xl font-extrabold text-primary">
                  {formatCLP(preview.amount_due)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground block">Total Cobrado</span>
                <span className="font-bold text-foreground text-sm">{formatCLP(preview.gross_total)}</span>
              </div>
              {preview.commission_base === "net" && (
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block">Costo Laboratorio</span>
                  <span className="font-bold text-rose-600 text-sm">− {formatCLP(preview.lab_discounts)}</span>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground block">Base Imponible</span>
                <span className="font-bold text-foreground text-sm">{formatCLP(preview.net_base)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground block">Atenciones en el mes</span>
                <span className="font-bold text-foreground text-sm">{preview.appointments.length} atenciones</span>
              </div>
            </div>

            {/* Acordeón de atenciones incluidas */}
            {preview.appointments.length > 0 && (
              <div className="border border-border rounded-lg bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(!previewOpen)}
                  className="w-full px-3 py-2 text-xs font-semibold text-foreground flex items-center justify-between hover:bg-muted/50"
                >
                  <span>Ver detalle de {preview.appointments.length} tratamientos</span>
                  {previewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {previewOpen && (
                  <div className="p-3 divide-y divide-border text-xs max-h-48 overflow-y-auto">
                    {preview.appointments.map((a) => (
                      <div key={a.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{a.description}</span>
                          <span className="text-muted-foreground block">{a.patient_name} · {a.date}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground">{formatCLP(a.paid_amount)}</span>
                          <span className="text-muted-foreground block">
                            Pago: {formatCLP(a.commission_amount)}
                            {a.pay_mode === "fixed" ? " (fijo)" : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveDraft}
                disabled={isPending}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar Liquidación"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Liquidaciones */}
      <div>
        <h3 className="font-bold text-foreground text-base mb-3 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Historial de Liquidaciones
        </h3>

        {safeSettlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-card border border-border rounded-xl">
            <FileText className="w-10 h-10 text-muted-foreground mb-2" />
            <h4 className="font-semibold text-foreground text-sm">Sin liquidaciones generadas</h4>
            <p className="text-muted-foreground text-xs max-w-sm mt-1">
              Usa la calculadora superior para generar las liquidaciones de honorarios de cada dentista.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {safeSettlements.map((s) => {
              const isPaid = s.status === "paid";

              return (
                <div
                  key={s.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-foreground text-sm">
                        {s.dentist_name}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {s.month.substring(0, 7)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {isPaid ? "Pagada" : "Borrador"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Base atenciones: {formatCLP(s.gross_total)} · Comisión pactada: {s.commission_pct}%
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Total a pagar</span>
                      <span className="text-base font-extrabold text-foreground">
                        {formatCLP(s.amount_due)}
                      </span>
                    </div>

                    {!isPaid ? (
                      <button
                        onClick={() => {
                          setError(null);
                          setPayTarget(s);
                        }}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 hover:opacity-90"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Pagar
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Liquidado en caja
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Confirmar Pago */}
      {payTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-1">Pagar Liquidación</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {payTarget.dentist_name} — Mes: {payTarget.month.substring(0, 7)} · Total:{" "}
              <strong className="text-foreground">{formatCLP(payTarget.amount_due)}</strong>
            </p>

            <form onSubmit={handlePay} className="space-y-4 text-sm">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 text-xs border border-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Medio de egreso (Caja) *
                </label>
                <select
                  name="payment_method"
                  required
                  defaultValue="transfer"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-xs"
                >
                  <option value="transfer">Transferencia bancaria</option>
                  <option value="cash">Efectivo</option>
                  <option value="other">Otro</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Se registrará automáticamente un <strong>egreso en Caja</strong> bajo la categoría "Remuneraciones / comisiones".
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:opacity-95 disabled:opacity-50"
                >
                  {isPending ? "Procesando..." : "Confirmar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
