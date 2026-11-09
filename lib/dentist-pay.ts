/**
 * Cálculo del pago al dentista y la ganancia de la clínica por atención.
 * Se usa en Atenciones (vista previa y listado) y en Liquidaciones,
 * para que todas las pantallas calculen exactamente igual.
 */

export type PayMode = "commission" | "fixed";
export type CommissionBase = "gross" | "net";

export type DentistPayDefaults = {
  pay_mode?: PayMode | null;
  fixed_fee?: number | null;
  commission_pct: number;
  commission_base: CommissionBase;
};

export type AppointmentCosts = {
  /** Monto sobre el que se calcula la comisión (total o lo cobrado). */
  base: number;
  lab_cost?: number | null;
  supplies_cost?: number | null;
  /** Valores propios de la atención; si vienen null se usan los del dentista. */
  dentist_pay_mode?: PayMode | null;
  dentist_pct?: number | null;
  dentist_fixed?: number | null;
};

export function effectivePayMode(a: AppointmentCosts, d: DentistPayDefaults): PayMode {
  return a.dentist_pay_mode ?? d.pay_mode ?? "commission";
}

export function computeDentistPay(a: AppointmentCosts, d: DentistPayDefaults): number {
  const mode = effectivePayMode(a, d);
  if (mode === "fixed") {
    return Math.max(0, Math.round(a.dentist_fixed ?? d.fixed_fee ?? 0));
  }
  const costs = (a.lab_cost ?? 0) + (a.supplies_cost ?? 0);
  const base = d.commission_base === "net" ? Math.max(0, a.base - costs) : a.base;
  const pct = Number(a.dentist_pct ?? d.commission_pct ?? 0);
  return Math.max(0, Math.round((base * pct) / 100));
}

/** Ganancia de la clínica = valor - laboratorio - insumos - pago dentista. */
export function computeClinicProfit(
  amount: number,
  lab_cost: number,
  supplies_cost: number,
  dentist_pay: number
): number {
  return amount - lab_cost - supplies_cost - dentist_pay;
}
