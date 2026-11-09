import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import {
  getMovementsByDate,
  getDaySummary,
  getCashCategories,
} from "@/app/actions/caja";
import type { DaySummary, CashMovement, CashCategory } from "@/app/actions/caja";
import { CajaClient } from "./CajaClient";

export const metadata: Metadata = {
  title: "Caja",
};

// Zona horaria Santiago para calcular fecha actual en el servidor
function todaySantiago() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
    .slice(0, 10);
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const params = await searchParams;
  const date = params.fecha ?? todaySantiago();

  const defaultSummary: DaySummary = {
    total_income: 0,
    total_expense: 0,
    by_method: {
      cash: { income: 0, expense: 0 },
      transfer: { income: 0, expense: 0 },
      debit: { income: 0, expense: 0 },
      credit: { income: 0, expense: 0 },
      other: { income: 0, expense: 0 },
    },
    closing: null,
  };

  let movements: CashMovement[] = [];
  let summary: DaySummary = defaultSummary;
  let categories: CashCategory[] = [];

  try {
    const results = await Promise.allSettled([
      getMovementsByDate(date, true), // incluye anulados para mostrarlos tachados
      getDaySummary(date),
      getCashCategories(),
    ]);

    if (results[0].status === "fulfilled") movements = results[0].value ?? [];
    if (results[1].status === "fulfilled") summary = results[1].value ?? defaultSummary;
    if (results[2].status === "fulfilled") categories = results[2].value ?? [];
  } catch (err) {
    console.error("Error loading /caja data:", err);
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          Caja diaria
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ingresos, egresos y cierre de caja por día.
        </p>
      </div>

      {/* Módulo interactivo */}
      <CajaClient
        initialDate={date}
        movements={movements}
        summary={summary}
        categories={categories}
      />
    </div>
  );
}
