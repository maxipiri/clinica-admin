import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getMonthSummary, getRecurringExpenses } from "@/app/actions/resumen";
import { getAppointments } from "@/app/actions/atenciones";
import { getLabOrders } from "@/app/actions/laboratorio";
import { CATEGORIES, PAYMENT_METHOD_LABEL } from "@/app/atenciones/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Respaldo del mes en Excel: GET /dashboard/exportar?mes=YYYY-MM
 * Hojas: Resumen, Atenciones, Por dentista, Caja, Laboratorio y Gastos.
 */

const CLP = '"$"#,##0;[Red]-"$"#,##0';
const BRAND = "FF0E7490";

const STATUS_PAGO: Record<string, string> = { pending: "Pendiente", partial: "Abonado", paid: "Pagado" };
const STATUS_LAB: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  received: "Recibida",
  installed: "Instalada",
  cancelled: "Cancelada",
};

function currentMonthCL() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(0, 7);
}
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01` };
}
function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "2026-11-05" → fecha de Excel (sin desfase de zona horaria). */
function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? "General";

type Col = { header: string; key: string; width: number; money?: boolean; date?: boolean };

function addTable(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], totals?: string[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  head.alignment = { vertical: "middle" };
  head.height = 20;
  rows.forEach((r) => ws.addRow(r));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.money) col.numFmt = CLP;
    if (c.date) col.numFmt = "dd-mm-yyyy";
  });
  if (rows.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  if (totals && rows.length > 0) {
    const last = rows.length + 1;
    const t = ws.addRow({});
    t.getCell(1).value = "TOTAL";
    cols.forEach((c, i) => {
      if (totals.includes(c.key)) {
        const L = ws.getColumn(i + 1).letter;
        t.getCell(i + 1).value = { formula: `SUM(${L}2:${L}${last})` };
      }
    });
    t.font = { bold: true };
    t.border = { top: { style: "thin" } };
  }
  return ws;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  const month = /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonthCL();
  const { start, end } = monthRange(month);
  const name = monthName(month);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const [summary, recurring, allAppts, allOrders, { data: movs }] = await Promise.all([
    getMonthSummary(month),
    getRecurringExpenses(month),
    getAppointments({ from: start, to: end }),
    getLabOrders(),
    supabase
      .from("cash_movements")
      .select("date, type, amount, payment_method, description, cash_categories(name)")
      .gte("date", start)
      .lt("date", end)
      .is("voided_at", null)
      .order("date"),
  ]);

  const appts = allAppts.filter((a) => a.date >= start && a.date < end).sort((a, b) => a.date.localeCompare(b.date));
  const orders = allOrders
    .filter((o) => (o.sent_date >= start && o.sent_date < end) || (o.billing_month ?? "").startsWith(month))
    .sort((a, b) => a.sent_date.localeCompare(b.sent_date));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clínica Admin";
  wb.created = new Date();

  // ── Resumen ────────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Resumen");
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws.addRow([`Resultado del mes · ${name}`]).font = { bold: true, size: 14 };
  ws.addRow([`Exportado el ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}`]).font = {
    italic: true,
    color: { argb: "FF6B7280" },
  };
  ws.addRow([]);
  const lines: [string, number][] = [
    ["Producción (atenciones realizadas)", summary.production],
    ["Pago a dentistas", -summary.dentists],
    ["Laboratorio", -summary.lab],
    ["Insumos", -summary.supplies],
    ["Gastos del mes (caja)", -summary.expenses],
  ];
  lines.forEach(([l, v]) => ws.addRow([l, v]));
  const g = ws.addRow(["Ganancia real", summary.profit]);
  g.font = { bold: true };
  g.border = { top: { style: "thin" } };
  ws.addRow([]);
  ws.addRow(["Entró a caja (abonos y pagos del mes)", summary.collected]);
  ws.addRow(["Por cobrar de las atenciones del mes", summary.pending_from_month]);
  ws.addRow(["Atenciones en el mes", summary.appointments_count]);
  ws.addRow([]);
  const ch = ws.addRow(["Por categoría", "Atenciones", "Producción", "Ganancia clínica"]);
  ch.font = { bold: true, color: { argb: "FFFFFFFF" } };
  ch.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  summary.by_category.forEach((c) => ws.addRow([catLabel(c.category), c.count, c.production, c.profit]));
  ws.getColumn(2).numFmt = CLP;
  ws.getColumn(3).numFmt = CLP;
  ws.getColumn(4).numFmt = CLP;
  // Conteos sin formato de pesos
  ws.eachRow((row) => {
    const label = String(row.getCell(1).value ?? "");
    if (label === "Atenciones en el mes") row.getCell(2).numFmt = "0";
    if (row.number > ch.number) row.getCell(2).numFmt = "0";
  });

  // ── Atenciones ─────────────────────────────────────────────────────────────
  addTable(
    wb,
    "Atenciones",
    [
      { header: "Fecha", key: "fecha", width: 12, date: true },
      { header: "Paciente", key: "paciente", width: 26 },
      { header: "Dentista", key: "dentista", width: 24 },
      { header: "Categoría", key: "categoria", width: 13 },
      { header: "Prestación", key: "prestacion", width: 40 },
      { header: "Valor", key: "valor", width: 13, money: true },
      { header: "Pagado", key: "pagado", width: 13, money: true },
      { header: "Saldo", key: "saldo", width: 13, money: true },
      { header: "Estado de pago", key: "estado", width: 14 },
      { header: "Laboratorio", key: "lab", width: 13, money: true },
      { header: "Insumos", key: "insumos", width: 12, money: true },
      { header: "Pago dentista", key: "pago_dentista", width: 14, money: true },
      { header: "Ganancia clínica", key: "ganancia", width: 15, money: true },
    ],
    appts.map((a) => ({
      fecha: toDate(a.date),
      paciente: a.patient_name ?? "",
      dentista: a.dentist_name ?? "",
      categoria: catLabel(a.category),
      prestacion: a.description || a.treatment_name || "",
      valor: a.amount,
      pagado: a.paid_amount,
      saldo: Math.max(0, a.amount - a.paid_amount),
      estado: STATUS_PAGO[a.payment_status] ?? a.payment_status,
      lab: a.lab_cost,
      insumos: a.supplies_cost,
      pago_dentista: a.dentist_pay,
      ganancia: a.clinic_profit,
    })),
    ["valor", "pagado", "saldo", "lab", "insumos", "pago_dentista", "ganancia"]
  );

  // ── Por dentista ───────────────────────────────────────────────────────────
  const byDentist = new Map<string, { n: number; prod: number; pay: number; profit: number }>();
  for (const a of appts) {
    const k = a.dentist_name ?? "Dentista";
    const d = byDentist.get(k) ?? { n: 0, prod: 0, pay: 0, profit: 0 };
    d.n += 1;
    d.prod += a.amount;
    d.pay += a.dentist_pay;
    d.profit += a.clinic_profit;
    byDentist.set(k, d);
  }
  addTable(
    wb,
    "Por dentista",
    [
      { header: "Dentista", key: "dentista", width: 28 },
      { header: "Atenciones", key: "n", width: 12 },
      { header: "Producción", key: "prod", width: 15, money: true },
      { header: "Pago dentista", key: "pay", width: 15, money: true },
      { header: "Ganancia clínica", key: "profit", width: 16, money: true },
    ],
    [...byDentist.entries()]
      .sort((a, b) => b[1].prod - a[1].prod)
      .map(([dentista, d]) => ({ dentista, n: d.n, prod: d.prod, pay: d.pay, profit: d.profit })),
    ["n", "prod", "pay", "profit"]
  );

  // ── Caja ───────────────────────────────────────────────────────────────────
  addTable(
    wb,
    "Caja",
    [
      { header: "Fecha", key: "fecha", width: 12, date: true },
      { header: "Tipo", key: "tipo", width: 10 },
      { header: "Categoría", key: "categoria", width: 24 },
      { header: "Descripción", key: "descripcion", width: 44 },
      { header: "Medio de pago", key: "medio", width: 15 },
      { header: "Ingreso", key: "ingreso", width: 13, money: true },
      { header: "Egreso", key: "egreso", width: 13, money: true },
    ],
    ((movs ?? []) as any[]).map((m) => ({
      fecha: toDate(m.date),
      tipo: m.type === "income" ? "Ingreso" : "Egreso",
      categoria: m.cash_categories?.name ?? "",
      descripcion: m.description ?? "",
      medio: PAYMENT_METHOD_LABEL[m.payment_method] ?? m.payment_method ?? "",
      ingreso: m.type === "income" ? m.amount : null,
      egreso: m.type === "income" ? null : m.amount,
    })),
    ["ingreso", "egreso"]
  );

  // ── Laboratorio ────────────────────────────────────────────────────────────
  addTable(
    wb,
    "Laboratorio",
    [
      { header: "Envío", key: "envio", width: 12, date: true },
      { header: "Paciente", key: "paciente", width: 26 },
      { header: "Dentista", key: "dentista", width: 24 },
      { header: "Laboratorio", key: "lab", width: 18 },
      { header: "Trabajo", key: "trabajo", width: 40 },
      { header: "Tratamiento", key: "categoria", width: 13 },
      { header: "Estado", key: "estado", width: 12 },
      { header: "Costo lab", key: "costo", width: 13, money: true },
      { header: "Cobro paciente", key: "cobro", width: 15, money: true },
      { header: "Pagado al lab", key: "pagado", width: 13 },
    ],
    orders.map((o) => ({
      envio: toDate(o.sent_date),
      paciente: o.patient_name,
      dentista: o.dentist_name,
      lab: o.lab_name ?? "",
      trabajo: o.work_type,
      categoria: catLabel(o.category),
      estado: STATUS_LAB[o.status] ?? o.status,
      costo: o.lab_cost,
      cobro: o.charged_to_patient,
      pagado: o.lab_paid ? "Sí" : "No",
    })),
    ["costo", "cobro"]
  );

  // ── Gastos ─────────────────────────────────────────────────────────────────
  const wg = addTable(
    wb,
    "Gastos",
    [
      { header: "Gasto del mes (por categoría de caja)", key: "nombre", width: 40 },
      { header: "Monto", key: "monto", width: 15, money: true },
    ],
    summary.expenses_by_category.map((e) => ({ nombre: e.name, monto: e.amount })),
    ["monto"]
  );
  wg.addRow([]);
  const fh = wg.addRow(["Gastos fijos", "Monto", "Estado"]);
  fh.font = { bold: true };
  recurring.forEach((r) =>
    wg.addRow([r.name, r.amount, !r.active ? "Pausado" : r.loaded ? "Cargado" : "Falta cargar"])
  );
  wg.getColumn(3).width = 14;

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Resultado-${month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
