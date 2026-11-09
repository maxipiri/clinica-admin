import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { getDentists } from "@/app/actions/dentistas";
import type { Dentist } from "@/app/actions/dentistas";
import { DentistasClient } from "./DentistasClient";

export const metadata: Metadata = {
  title: "Dentistas",
};

export default async function DentistasPage() {
  let dentists: Dentist[] = [];

  try {
    const results = await Promise.allSettled([getDentists(false)]);
    if (results[0].status === "fulfilled") {
      dentists = results[0].value ?? [];
    }
  } catch (err) {
    console.error("Error loading /dentistas:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserRound className="w-6 h-6 text-primary" />
          Dentistas y Profesionales
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administración del equipo médico, configuración de porcentajes y bases de comisión.
        </p>
      </div>

      <DentistasClient dentists={dentists} />
    </div>
  );
}
