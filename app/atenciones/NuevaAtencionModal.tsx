"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, X as XIcon, PlusCircle } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import { computeDentistPay, computeClinicProfit, type PayMode } from "@/lib/dentist-pay";
import type { Appointment, TreatmentItem, TreatmentCategory } from "@/app/actions/atenciones";
import type { Dentist } from "@/app/actions/dentistas";
import type { Patient } from "@/app/actions/pacientes";
import { CATEGORIES } from "./categories";
import { TreatmentPicker } from "./TreatmentPicker";
import { PatientPicker } from "./PatientPicker";

type CartItem = { key: number; treatment_id: string | null; description: string; amount: string };
let cartSeq = 0;

/** Valor por defecto de cada corona sobre implante (costo laboratorio). */
const CORONA_DEFAULT = 100000;
/** Abono inicial por defecto en prótesis. */
const ABONO_INICIAL_PROTESIS = 100000;

const MATERIALES = [
  { key: "acrilica", label: "Acrílica" },
  { key: "flexible", label: "Flexible (Valplast)" },
  { key: "metalica", label: "Metálica" },
];

const EXT_LABEL: Record<string, string> = {
  unilateral: "Unilateral",
  parcial: "Parcial",
  total: "Total",
  inmediata: "Inmediata",
};

const inputCls =
  "w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelCls = "block text-xs font-semibold text-foreground mb-1";

const num = (v: string) => (v === "" ? 0 : Math.max(0, Math.round(Number(v) || 0)));

export function NuevaAtencionModal({
  dentists,
  patients,
  treatments,
  error,
  isPending,
  onSubmit,
  onClose,
  initialCategory = "general",
  editing = null,
}: {
  dentists: Dentist[];
  patients: Patient[];
  treatments: TreatmentItem[];
  error: string | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  initialCategory?: TreatmentCategory;
  /** Si viene una atención, el formulario funciona en modo edición. */
  editing?: Appointment | null;
}) {
  const isEdit = !!editing;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  // En edición se muestran también dentistas inactivos, por si la atención es de uno.
  const activeDentists = dentists.filter((d) => d.active || d.id === editing?.dentist_id);

  const prosthesisItems = treatments.filter((t) => t.category === "prosthesis");
  const implantItem = treatments.find((t) => t.category === "implant");
  const generalItems = treatments.filter((t) => t.category === "general");
  const orthoItems = treatments.filter((t) => t.category === "orthodontics");

  // ─── Estado inicial (nuevo o edición) ──────────────────────────────────────
  const startCategory: TreatmentCategory = editing?.category ?? initialCategory;
  const startDentist = (() => {
    if (editing) return activeDentists.find((d) => d.id === editing.dentist_id);
    if (startCategory === "implant") return activeDentists.find((d) => d.pay_mode === "fixed");
    return undefined;
  })();
  const startCrownQty = editing ? Math.max(1, editing.crown_qty ?? 1) : 1;
  const startCrownUnit =
    editing && editing.category === "implant" && editing.lab_cost > 0
      ? Math.round(editing.lab_cost / startCrownQty)
      : CORONA_DEFAULT;

  const [category, setCategory] = useState<TreatmentCategory>(startCategory);
  const [dentistId, setDentistId] = useState(startDentist?.id ?? "");
  const [treatmentId, setTreatmentId] = useState(
    editing?.treatment_id ?? (startCategory === "implant" ? implantItem?.id ?? "" : "")
  );
  const [patientId, setPatientId] = useState(editing?.patient_id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [description, setDescription] = useState(
    editing?.description ?? (startCategory === "implant" ? implantItem?.name ?? "Implante" : "")
  );
  const [amount, setAmount] = useState(
    editing ? String(editing.amount) : startCategory === "implant" && implantItem ? String(implantItem.default_price) : ""
  );
  const [paid, setPaid] = useState(
    startCategory === "prosthesis" ? String(ABONO_INICIAL_PROTESIS) : "0"
  );
  const [payMethod, setPayMethod] = useState("");
  const [labCost, setLabCost] = useState(editing ? String(editing.lab_cost) : "0");
  const [suppliesCost, setSuppliesCost] = useState(editing ? String(editing.supplies_cost) : "0");
  const [crownQty, setCrownQty] = useState(startCrownQty);
  const [crownUnit, setCrownUnit] = useState(String(startCrownUnit));
  const [material, setMaterial] = useState(
    prosthesisItems.find((t) => t.id === editing?.treatment_id)?.material ?? "acrilica"
  );
  const [payMode, setPayMode] = useState<PayMode>(
    editing?.effective_pay_mode ?? startDentist?.pay_mode ?? "commission"
  );
  const [pct, setPct] = useState(
    String(editing?.dentist_pct ?? startDentist?.commission_pct ?? 0)
  );
  const [fixed, setFixed] = useState(
    String(editing?.dentist_fixed ?? startDentist?.fixed_fee ?? 0)
  );

  const dentist = activeDentists.find((d) => d.id === dentistId);
  const isImplant = category === "implant";
  // En implantes el costo de laboratorio = coronas × valor corona
  const effectiveLab = isImplant ? crownQty * num(crownUnit) : num(labCost);

  function applyDentist(id: string) {
    setDentistId(id);
    const d = activeDentists.find((x) => x.id === id);
    if (!d) return;
    setPayMode(d.pay_mode ?? "commission");
    setPct(String(d.commission_pct ?? 0));
    setFixed(String(d.fixed_fee ?? 0));
  }

  function changeCategory(c: TreatmentCategory) {
    setCategory(c);
    setCart([]);
    setTreatmentId("");
    setLabCost("0");
    setSuppliesCost("0");
    setCrownQty(1);
    setCrownUnit(String(CORONA_DEFAULT));
    if (!isEdit) setPaid(c === "prosthesis" ? String(ABONO_INICIAL_PROTESIS) : "0");
    if (c === "implant") {
      if (implantItem) {
        setTreatmentId(implantItem.id);
        setDescription(implantItem.name);
        setAmount(String(implantItem.default_price));
      }
      const implantologo = activeDentists.find((d) => d.pay_mode === "fixed");
      if (implantologo && (!dentist || dentist.pay_mode !== "fixed")) applyDentist(implantologo.id);
    } else if (!isEdit) {
      setDescription("");
      setAmount("");
    }
  }

  function pickProsthesis(t: TreatmentItem) {
    setTreatmentId(t.id);
    setDescription(t.name);
    setAmount(String(t.default_price));
    setLabCost(String(t.lab_cost));
  }

  function pickFromSelect(items: TreatmentItem[], id: string) {
    setTreatmentId(id);
    const t = items.find((x) => x.id === id);
    if (t) {
      setDescription(t.name);
      setAmount(String(t.default_price));
      setLabCost(String(t.lab_cost ?? 0));
    }
  }

  /** General / Ortodoncia nuevas: se pueden agregar varios tratamientos a la visita. */
  const cartMode = !isEdit && (category === "general" || category === "orthodontics");
  const cartTotal = cart.reduce((sum, i) => sum + num(i.amount), 0);

  function addToCart(t: TreatmentItem | null) {
    setCart((c) => [
      ...c,
      {
        key: ++cartSeq,
        treatment_id: t?.id ?? null,
        description: t?.name ?? "",
        amount: t ? String(t.default_price) : "",
      },
    ]);
  }
  function updateCart(key: number, patch: Partial<CartItem>) {
    setCart((c) => c.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // ─── Cálculo en vivo ───────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const a = cartMode ? cartTotal : num(amount);
    const lab = effectiveLab;
    const sup = num(suppliesCost);
    const pay = dentist
      ? computeDentistPay(
          {
            base: a,
            lab_cost: lab,
            supplies_cost: sup,
            dentist_pay_mode: payMode,
            dentist_pct: Number(pct) || 0,
            dentist_fixed: num(fixed),
          },
          dentist
        )
      : 0;
    const profit = computeClinicProfit(a, lab, sup, pay);
    const alreadyPaid = editing?.paid_amount ?? 0;
    const paidNow = isEdit ? 0 : Math.min(num(paid), a);
    return { a, lab, sup, pay, profit, paidNow, balance: a - alreadyPaid - paidNow };
  }, [amount, effectiveLab, suppliesCost, payMode, pct, fixed, paid, dentist, editing, isEdit, cartMode, cartTotal]);

  const selectedProsthesis = prosthesisItems.find((t) => t.id === treatmentId);
  const showLabCost = category === "prosthesis" || ((category === "general" || category === "orthodontics") && num(labCost) > 0);
  const catalogForSelect = category === "orthodontics" ? orthoItems : generalItems;
  const catMeta = CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl p-6 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-foreground mb-4">
          {isEdit ? "Editar atención" : `Nueva atención · ${catMeta.label}`}
        </h3>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          {/* Valores que viajan al servidor */}
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="treatment_id" value={treatmentId} />
          <input type="hidden" name="lab_cost" value={calc.lab} />
          <input type="hidden" name="supplies_cost" value={calc.sup} />
          {isImplant && <input type="hidden" name="crown_qty" value={crownQty} />}
          <input type="hidden" name="dentist_pay_mode" value={dentist ? payMode : ""} />
          {dentist && payMode === "commission" && (
            <input type="hidden" name="dentist_pct" value={Number(pct) || 0} />
          )}
          {dentist && payMode === "fixed" && (
            <input type="hidden" name="dentist_fixed" value={num(fixed)} />
          )}

          {/* Categoría */}
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeCategory(key)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors",
                  category === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input
                name="date"
                type="date"
                required
                defaultValue={editing?.date ?? today}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{isImplant ? "Implantólogo *" : "Dentista tratante *"}</label>
              <select
                name="dentist_id"
                required
                value={dentistId}
                onChange={(e) => applyDentist(e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar...</option>
                {activeDentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}{" "}
                    {d.pay_mode === "fixed" ? `(fijo ${formatCLP(d.fixed_fee ?? 0)})` : `(${d.commission_pct}%)`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Paciente *</label>
            <PatientPicker patients={patients} value={patientId} onChange={setPatientId} />
          </div>

          {/* ─── Selector según categoría ─── */}
          {(category === "general" || category === "orthodontics") && (
            <div>
              <label className={labelCls}>{cartMode ? "Tratamientos de la visita" : "Tratamiento"}</label>
              <TreatmentPicker
                key={category}
                items={catalogForSelect}
                category={category}
                selectedIds={cartMode ? cart.map((i) => i.treatment_id ?? "") : [treatmentId]}
                onPick={(t) => (cartMode ? addToCart(t) : pickFromSelect(catalogForSelect, t.id))}
              />
            </div>
          )}

          {cartMode && (
            <div className="rounded-xl border border-border overflow-hidden">
              <input type="hidden" name="items" value={JSON.stringify(cart.map((i) => ({ treatment_id: i.treatment_id, description: i.description, amount: num(i.amount) })))} />
              <input type="hidden" name="description" value={cart.map((i) => i.description).join(" + ") || "-"} />
              <input type="hidden" name="amount" value={cartTotal} />
              {cart.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  Toca los tratamientos de arriba para agregarlos. Puedes sumar varios en la misma visita
                  (ej: limpieza + radiografía + restauración).
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {cart.map((i) => (
                    <div key={i.key} className="flex items-center gap-2 px-3 py-2">
                      <input
                        className={cn(inputCls, "py-1.5 text-sm flex-1")}
                        value={i.description}
                        placeholder="Descripción (ej: pieza 2.4)"
                        onChange={(e) => updateCart(i.key, { description: e.target.value })}
                        required
                      />
                      <input
                        className={cn(inputCls, "py-1.5 text-sm font-mono w-28")}
                        type="number"
                        min="0"
                        value={i.amount}
                        onChange={(e) => updateCart(i.key, { amount: e.target.value })}
                        required
                        aria-label="Valor"
                      />
                      <button
                        type="button"
                        onClick={() => setCart((c) => c.filter((x) => x.key !== i.key))}
                        className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-accent"
                        title="Quitar"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 bg-muted/40 text-sm font-semibold">
                    <span>Total visita ({cart.length})</span>
                    <span className="font-mono">{formatCLP(cartTotal)}</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => addToCart(null)}
                className="w-full px-3 py-2 border-t border-border text-xs font-semibold text-primary hover:bg-accent inline-flex items-center justify-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Agregar tratamiento escrito a mano
              </button>
            </div>
          )}

          {category === "prosthesis" && (
            <div className="space-y-2">
              <label className={labelCls}>Tipo de prótesis *</label>
              <div className="flex gap-2">
                {MATERIALES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMaterial(m.key)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg border text-xs font-semibold",
                      material === m.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-accent"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {prosthesisItems
                  .filter((t) => t.material === material)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickProsthesis(t)}
                      className={cn(
                        "text-left p-3 rounded-xl border transition-colors",
                        treatmentId === t.id
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <p className="font-semibold text-foreground text-xs">{EXT_LABEL[t.extension ?? ""] ?? t.name}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{formatCLP(t.default_price)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Lab: {t.lab_cost > 0 ? formatCLP(t.lab_cost) : "por confirmar"}
                      </p>
                    </button>
                  ))}
              </div>
              {selectedProsthesis && selectedProsthesis.lab_cost === 0 && (
                <p className="text-xs text-amber-600">
                  Esta prótesis no tiene costo de laboratorio cargado: escríbelo abajo.
                </p>
              )}
            </div>
          )}

          {isImplant && (
            <div className="p-3 rounded-xl border border-border space-y-2">
              <span className="text-xs font-semibold text-foreground">Coronas (laboratorio) *</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCrownQty((q) => Math.max(1, q - 1))}
                    className="px-2.5 py-2 hover:bg-accent disabled:opacity-40"
                    disabled={crownQty <= 1}
                    aria-label="Quitar corona"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-bold font-mono">{crownQty}</span>
                  <button
                    type="button"
                    onClick={() => setCrownQty((q) => q + 1)}
                    className="px-2.5 py-2 hover:bg-accent"
                    aria-label="Agregar corona"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">×</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={crownUnit}
                  onChange={(e) => setCrownUnit(e.target.value)}
                  className={cn(inputCls, "font-mono w-32")}
                  aria-label="Valor por corona"
                />
                <span className="text-xs text-muted-foreground">=</span>
                <span className="font-bold font-mono">{formatCLP(effectiveLab)}</span>
              </div>
            </div>
          )}

          {!cartMode && (
          <div>
            <label className={labelCls}>Descripción del tratamiento realizado *</label>
            <input
              name="description"
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isImplant
                  ? "Ej: Implante pieza 3.6"
                  : category === "orthodontics"
                  ? "Ej: Ortodoncia brackets metálicos"
                  : "Ej: Obturación resina pieza 2.4"
              }
              className={inputCls}
            />
          </div>
          )}

          {/* ─── Montos ─── */}
          <div className="grid grid-cols-2 gap-3">
            {cartMode ? (
              <div>
                <label className={labelCls}>Total de la visita</label>
                <p className="px-3 py-2 rounded-lg bg-muted font-mono">{formatCLP(cartTotal)}</p>
              </div>
            ) : (
            <div>
              <label className={labelCls}>Valor al paciente (CLP) *</label>
              <input
                name="amount"
                type="number"
                min={editing?.paid_amount ?? 0}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="35000"
                className={cn(inputCls, "font-mono")}
              />
            </div>
            )}
            {isEdit ? (
              <div>
                <label className={labelCls}>Ya cobrado</label>
                <p className="px-3 py-2 rounded-lg bg-muted font-mono">{formatCLP(editing!.paid_amount)}</p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Abono inicial (CLP)</label>
                <input
                  name="paid_amount"
                  type="number"
                  min="0"
                  step="1"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  className={cn(inputCls, "font-mono")}
                />
              </div>
            )}
          </div>

          {(showLabCost || category !== "general") && (
            <div className="grid grid-cols-2 gap-3">
              {!isImplant && (
                <div>
                  <label className={labelCls}>Costo laboratorio (CLP)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={labCost}
                    onChange={(e) => setLabCost(e.target.value)}
                    className={cn(inputCls, "font-mono")}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Insumos (CLP)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={suppliesCost}
                  onChange={(e) => setSuppliesCost(e.target.value)}
                  placeholder={isImplant ? "Implante, pilar, tornillo..." : "0"}
                  className={cn(inputCls, "font-mono")}
                />
              </div>
            </div>
          )}

          {/* ─── Pago al dentista ─── */}
          {dentist && (
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Pago a {dentist.full_name}</span>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  {(["commission", "fixed"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMode(m)}
                      className={cn(
                        "px-2.5 py-1 font-semibold",
                        payMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {m === "commission" ? "Porcentaje" : "Monto fijo"}
                    </button>
                  ))}
                </div>
              </div>
              {payMode === "commission" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={pct}
                    onChange={(e) => setPct(e.target.value)}
                    className={cn(inputCls, "font-mono w-24")}
                  />
                  <span className="text-xs text-muted-foreground">
                    % sobre {dentist.commission_base === "net" ? "valor menos lab e insumos" : "el valor total"}
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={fixed}
                  onChange={(e) => setFixed(e.target.value)}
                  className={cn(inputCls, "font-mono")}
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Aplica solo a esta atención. El valor por defecto se edita en Dentistas.
              </p>
            </div>
          )}

          {/* ─── Resumen ─── */}
          {calc.a > 0 && (
            <div className="rounded-xl border border-border p-3 space-y-1 text-xs font-mono">
              <Row label="Valor paciente" value={calc.a} />
              {calc.lab > 0 && (
                <Row label={isImplant ? `Coronas (${crownQty})` : "Laboratorio"} value={-calc.lab} />
              )}
              {calc.sup > 0 && <Row label="Insumos" value={-calc.sup} />}
              {dentist && <Row label={dentist.full_name} value={-calc.pay} />}
              <div className="border-t border-border pt-1 mt-1">
                <Row label="Ganancia clínica" value={calc.profit} strong />
              </div>
              {calc.balance > 0 && (
                <p className="text-muted-foreground pt-1 font-sans">
                  Saldo por cobrar: <strong className="text-rose-600">{formatCLP(calc.balance)}</strong>
                </p>
              )}
            </div>
          )}

          {!isEdit && (
            <div>
              <label className={labelCls}>
                Medio de pago del abono inicial{calc.paidNow > 0 ? " *" : ""}
              </label>
              <select
                name="payment_method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                required={calc.paidNow > 0}
                className={inputCls}
              >
                <option value="">{calc.paidNow > 0 ? "Seleccionar..." : "Sin abono inicial"}</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia bancaria</option>
                <option value="debit">Tarjeta Débito (Redcompra)</option>
                <option value="credit">Tarjeta Crédito</option>
                <option value="other">Otro</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                El abono inicial queda registrado en la <strong>Caja diaria</strong> y en el historial de abonos.
              </p>
            </div>
          )}

          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Los pagos no se editan aquí: usa <strong>Abonar</strong> para registrar uno nuevo.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar atención"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-bold text-sm")}>
      <span className="font-sans text-muted-foreground">{label}</span>
      <span
        className={cn(
          value < 0 ? "text-rose-600" : "text-foreground",
          strong && value >= 0 && "text-emerald-600"
        )}
      >
        {value < 0 ? `−${formatCLP(-value)}` : formatCLP(value)}
      </span>
    </div>
  );
}
