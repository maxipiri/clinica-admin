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

/** Color fijo de cada categoría (el mismo en toda la app). */
export const CATEGORY_COLOR: Record<TreatmentCategory, { main: string; bg: string; border: string }> = {
  prosthesis: { main: "#db2777", bg: "#fdf2f8", border: "#fbcfe8" },   // rosado
  implant: { main: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },      // azul
  endodontics: { main: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },  // verde
  orthodontics: { main: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" }, // morado
  aesthetics: { main: "#d97706", bg: "#fffbeb", border: "#fde68a" },   // ámbar
  general: { main: "#475569", bg: "#f8fafc", border: "#e2e8f0" },      // gris
};
