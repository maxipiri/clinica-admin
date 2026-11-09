import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { getCatalogAll } from "@/app/actions/prestaciones";
import { PrestacionesClient } from "./PrestacionesClient";

export const metadata: Metadata = {
  title: "Prestaciones",
};

export default async function PrestacionesPage() {
  const items = await getCatalogAll();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Tags className="w-6 h-6 text-primary" />
          Prestaciones
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Arancel de la clínica: precios base que se cargan al registrar una atención. Cambia aquí los precios
          (por ejemplo, una promoción) y aplicará a las atenciones nuevas.
        </p>
      </div>
      <PrestacionesClient items={items} />
    </div>
  );
}
