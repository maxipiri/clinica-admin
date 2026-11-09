import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getAppointments, getTreatmentsCatalog } from "@/app/actions/atenciones";
import { getDentists } from "@/app/actions/dentistas";
import { getPatients } from "@/app/actions/pacientes";
import type { Appointment, TreatmentItem } from "@/app/actions/atenciones";
import type { Dentist } from "@/app/actions/dentistas";
import type { Patient } from "@/app/actions/pacientes";
import { AtencionesClient } from "./AtencionesClient";

export const metadata: Metadata = {
  title: "Atenciones",
};

export default async function AtencionesPage() {
  let appointments: Appointment[] = [];
  let dentists: Dentist[] = [];
  let patients: Patient[] = [];
  let treatments: TreatmentItem[] = [];

  try {
    const results = await Promise.allSettled([
      getAppointments(),
      getDentists(false),
      getPatients(),
      getTreatmentsCatalog(),
    ]);

    if (results[0].status === "fulfilled") appointments = results[0].value ?? [];
    if (results[1].status === "fulfilled") dentists = results[1].value ?? [];
    if (results[2].status === "fulfilled") patients = results[2].value ?? [];
    if (results[3].status === "fulfilled") treatments = results[3].value ?? [];
  } catch (err) {
    console.error("Error loading /atenciones:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Atenciones Realizadas
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registro de tratamientos clínicos, cobros a pacientes y abonos automáticos a la caja diaria.
        </p>
      </div>

      <AtencionesClient
        appointments={appointments}
        dentists={dentists}
        patients={patients}
        treatments={treatments}
      />
    </div>
  );
}
