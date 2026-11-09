import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, MessageCircle, PhoneOff } from "lucide-react";
import { getAppointments } from "@/app/actions/atenciones";
import { formatCLP, cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Cobranza",
};

function todayCL() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}
function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / 86_400_000);
}
function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`)
  );
}

export default async function CobranzaPage() {
  const today = todayCL();
  const appts = (await getAppointments()).filter((a) => a.amount > a.paid_amount);

  // Agrupar por paciente
  const byPatient = new Map<
    string,
    {
      id: string;
      name: string;
      phone: string | null;
      balance: number;
      items: { description: string; balance: number }[];
      lastActivity: string; // último abono o, si no hay, fecha de la atención
    }
  >();
  for (const a of appts) {
    const balance = a.amount - a.paid_amount;
    const lastPay = a.payments.length ? a.payments[a.payments.length - 1].date : a.date;
    const entry = byPatient.get(a.patient_id) ?? {
      id: a.patient_id,
      name: a.patient_name ?? "Paciente",
      phone: a.patient_phone ?? null,
      balance: 0,
      items: [],
      lastActivity: lastPay,
    };
    entry.balance += balance;
    entry.items.push({ description: a.description, balance });
    if (lastPay > entry.lastActivity) entry.lastActivity = lastPay;
    byPatient.set(a.patient_id, entry);
  }
  const rows = [...byPatient.values()]
    .map((r) => ({ ...r, days: Math.max(0, daysBetween(r.lastActivity, today)) }))
    .sort((a, b) => b.days - a.days || b.balance - a.balance);
  const total = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HandCoins className="w-6 h-6 text-primary" />
          Cobranza
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pacientes con saldo pendiente, ordenados por más días sin abonar. El botón de WhatsApp abre un recordatorio
          listo para enviar.
        </p>
      </div>

      <div className="p-4 bg-card border border-border rounded-xl flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Total por cobrar</p>
          <p className="text-2xl font-bold text-rose-600">{formatCLP(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pacientes con saldo</p>
          <p className="text-2xl font-bold text-foreground">{rows.length}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-xl text-sm text-muted-foreground">
          No hay saldos pendientes. 🎉
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {rows.map((r) => {
            const first = r.name.split(" ")[0];
            const wa = whatsappLink(
              r.phone,
              `Hola ${first}, te saludamos de Clínica Plaza Dent 🦷. Te recordamos que tienes un saldo pendiente de ${formatCLP(
                r.balance
              )} (${r.items.map((i) => i.description).join(", ")}). Puedes abonar en tu próxima visita o por transferencia. ¡Muchas gracias!`
            );
            return (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Link href={`/pacientes/${r.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.items.map((i) => i.description).join(" · ")}</p>
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      r.days > 60 ? "text-rose-600" : r.days > 30 ? "text-amber-600" : "text-muted-foreground"
                    )}
                  >
                    Último movimiento: {fechaCorta(r.lastActivity)} ·{" "}
                    {r.days === 0 ? "hoy" : `hace ${r.days} día${r.days === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-lg font-bold text-rose-600 font-mono">{formatCLP(r.balance)}</span>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  ) : (
                    <Link
                      href={`/pacientes`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent"
                      title="Agrega el celular del paciente para enviarle WhatsApp"
                    >
                      <PhoneOff className="w-4 h-4" /> Sin celular
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
