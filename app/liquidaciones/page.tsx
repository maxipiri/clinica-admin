import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { getSettlements } from "@/app/actions/liquidaciones";
import { getDentists } from "@/app/actions/dentistas";
import type { Settlement } from "@/app/actions/liquidaciones";
import type { Dentist } from "@/app/actions/dentistas";
import { LiquidacionesClient } from "./LiquidacionesClient";

export const metadata: Metadata = {
  title: "Liquidaciones",
};

function currentMonthSantiago() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
    .slice(0, 7);
}

export default async function LiquidacionesPage() {
  let settlements: Settlement[] = [];
  let dentists: Dentist[] = [];
  const currentMonth = currentMonthSantiago();

  try {
    const results = await Promise.allSettled([
      getSettlements(),
      getDentists(true),
    ]);

    if (results[0].status === "fulfilled") settlements = results[0].value ?? [];
    if (results[1].status === "fulfilled") dentists = results[1].value ?? [];
  } catch (err) {
    console.error("Error loading /liquidaciones:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Receipt className="w-6 h-6 text-primary" />
          Liquidación de Dentistas
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cálculo mensual de honorarios por comisiones brutas o netas y pago automático registrado en caja.
        </p>
      </div>

      <LiquidacionesClient
        settlements={settlements}
        dentists={dentists}
        currentMonth={currentMonth}
      />
    </div>
  );
}
