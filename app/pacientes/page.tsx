import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getPatients } from "@/app/actions/pacientes";
import type { Patient } from "@/app/actions/pacientes";
import { PacientesClient } from "./PacientesClient";

export const metadata: Metadata = {
  title: "Pacientes",
};

export default async function PacientesPage() {
  let patients: Patient[] = [];

  try {
    const results = await Promise.allSettled([getPatients()]);
    if (results[0].status === "fulfilled") {
      patients = results[0].value ?? [];
    }
  } catch (err) {
    console.error("Error loading /pacientes:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Ficha de Pacientes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Listado de pacientes registrados, datos de contacto y observaciones clínicas.
        </p>
      </div>

      <PacientesClient patients={patients} />
    </div>
  );
}
