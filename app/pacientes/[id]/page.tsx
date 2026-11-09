import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, IdCard, MessageCircle, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAppointments } from "@/app/actions/atenciones";
import { formatCLP } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { CATEGORIES, PAYMENT_METHOD_LABEL } from "@/app/atenciones/categories";

export const metadata: Metadata = {
  title: "Ficha del paciente",
};

function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`)
  );
}

const STATUS_LABEL = { pending: "Pendiente", partial: "Abono parcial", paid: "Pagado" } as const;
const STATUS_CLS = {
  pending: "text-rose-600",
  partial: "text-amber-600",
  paid: "text-emerald-600",
} as const;

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, rut, phone, email, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!patient) notFound();

  const appointments = await getAppointments({ patient_id: id });
  const total = appointments.reduce((s, a) => s + a.amount, 0);
  const paid = appointments.reduce((s, a) => s + a.paid_amount, 0);
  const balance = Math.max(0, total - paid);

  const payments = appointments
    .flatMap((a) => a.payments.map((p) => ({ ...p, treatment: a.description })))
    .sort((x, y) => y.date.localeCompare(x.date));

  const pendingItems = appointments.filter((a) => a.amount > a.paid_amount);
  const wa = whatsappLink(
    patient.phone,
    balance > 0
      ? `Hola ${patient.full_name.split(" ")[0]}, te saludamos de Clínica Plaza Dent 🦷. Te recordamos que tienes un saldo pendiente de ${formatCLP(
          balance
        )} (${pendingItems.map((a) => a.description).join(", ")}). Puedes abonar en tu próxima visita o por transferencia. ¡Gracias!`
      : `Hola ${patient.full_name.split(" ")[0]}, te saludamos de Clínica Plaza Dent 🦷.`
  );

  return (
    <div className="space-y-4">
      <Link href="/pacientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Pacientes
      </Link>

      {/* Datos */}
      <div className="p-5 bg-card border border-border rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{patient.full_name}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {patient.rut && (
              <span className="inline-flex items-center gap-1.5">
                <IdCard className="w-4 h-4" /> {patient.rut}
              </span>
            )}
            {patient.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4" /> {patient.phone}
              </span>
            )}
            {patient.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-4 h-4" /> {patient.email}
              </span>
            )}
          </div>
          {patient.notes && <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">{patient.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              <MessageCircle className="w-4 h-4" />
              {balance > 0 ? "Recordar saldo por WhatsApp" : "WhatsApp"}
            </a>
          )}
          <Link
            href="/atenciones"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            <ClipboardList className="w-4 h-4" /> Ir a Atenciones
          </Link>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-card border border-border rounded-xl">
          <p className="text-xs text-muted-foreground">Total tratamientos ({appointments.length})</p>
          <p className="text-xl font-bold text-foreground">{formatCLP(total)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <p className="text-xs text-muted-foreground">Total abonado</p>
          <p className="text-xl font-bold text-emerald-600">{formatCLP(paid)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <p className="text-xs text-muted-foreground">Saldo pendiente</p>
          <p className={`text-xl font-bold ${balance > 0 ? "text-rose-600" : "text-foreground"}`}>{formatCLP(balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        {/* Tratamientos */}
        <div className="bg-card border border-border rounded-xl">
          <h2 className="px-4 py-3 font-bold text-foreground border-b border-border">Tratamientos</h2>
          {appointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin atenciones registradas.</p>
          ) : (
            <div className="divide-y divide-border">
              {appointments.map((a) => {
                const cat = CATEGORIES.find((c) => c.key === a.category) ?? CATEGORIES[3];
                const pending = Math.max(0, a.amount - a.paid_amount);
                return (
                  <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fechaCorta(a.date)} · {cat.label} · {a.dentist_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold font-mono">{formatCLP(a.amount)}</p>
                      <p className={`text-xs font-semibold ${STATUS_CLS[a.payment_status]}`}>
                        {STATUS_LABEL[a.payment_status]}
                        {pending > 0 ? ` · resta ${formatCLP(pending)}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Abonos */}
        <div className="bg-card border border-border rounded-xl">
          <h2 className="px-4 py-3 font-bold text-foreground border-b border-border">Historial de abonos</h2>
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin abonos registrados en caja.</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground capitalize">{fechaCorta(p.date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method} · {p.treatment}
                    </p>
                  </div>
                  <p className="font-mono font-semibold">{formatCLP(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
