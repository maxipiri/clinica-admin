import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import {
  getLabs,
  getLabOrders,
  getLabBillingSummary,
} from "@/app/actions/laboratorio";
import type { Lab, LabOrder, LabBillingSummary } from "@/app/actions/laboratorio";
import { LaboratorioClient } from "./LaboratorioClient";

export const metadata: Metadata = {
  title: "Laboratorio",
};

export default async function LaboratorioPage() {
  let labs: Lab[] = [];
  let orders: LabOrder[] = [];
  let billingSummaries: LabBillingSummary[] = [];

  try {
    const results = await Promise.allSettled([
      getLabs(false), // obtener laboratorios (activos e inactivos)
      getLabOrders(),
      getLabBillingSummary(),
    ]);

    if (results[0].status === "fulfilled") labs = results[0].value ?? [];
    if (results[1].status === "fulfilled") orders = results[1].value ?? [];
    if (results[2].status === "fulfilled") billingSummaries = results[2].value ?? [];
  } catch (err) {
    console.error("Error loading /laboratorio data:", err);
  }

  const overdueCount = (orders ?? []).filter((o) => o?.is_overdue).length;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          Laboratorio y Prótesis
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control de órdenes protésicas, plazos de entrega y cuentas por pagar a laboratorios.
        </p>
      </div>

      {/* Módulo interactivo */}
      <LaboratorioClient
        labs={labs}
        orders={orders}
        billingSummaries={billingSummaries}
        overdueCount={overdueCount}
      />
    </div>
  );
}
