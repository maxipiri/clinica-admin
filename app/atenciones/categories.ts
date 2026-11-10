import { Smile, Bolt, Sparkles, Stethoscope, Activity, Syringe, type LucideIcon } from "lucide-react";
import type { TreatmentCategory } from "@/app/actions/atenciones";

export const CATEGORIES: {
  key: TreatmentCategory;
  label: string;
  plural: string;
  newLabel: string;
  icon: LucideIcon;
}[] = [
  { key: "prosthesis", label: "Prótesis", plural: "Prótesis", newLabel: "Nueva prótesis", icon: Smile },
  { key: "implant", label: "Implante", plural: "Implantes", newLabel: "Nuevo implante", icon: Bolt },
  { key: "endodontics", label: "Endodoncia", plural: "Endodoncias", newLabel: "Nueva endodoncia", icon: Activity },
  { key: "orthodontics", label: "Ortodoncia", plural: "Ortodoncia", newLabel: "Nueva ortodoncia", icon: Sparkles },
  { key: "aesthetics", label: "Estética", plural: "Estética", newLabel: "Nueva estética", icon: Syringe },
  { key: "general", label: "General", plural: "General", newLabel: "Nueva atención general", icon: Stethoscope },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  debit: "Débito",
  credit: "Crédito",
  other: "Otro",
};

/** Categoría General (respaldo cuando una atención no tiene categoría conocida). */
export const GENERAL_CATEGORY = CATEGORIES.find((c) => c.key === "general")!;
