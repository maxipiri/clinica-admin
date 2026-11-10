"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import type { TreatmentItem, PickerCategory } from "@/app/actions/atenciones";

/** Quita tildes y pasa a minúsculas para comparar ("Restauración" = "restauracion"). */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const firstLetter = (s: string) => normalize(s).charAt(0).toUpperCase();

/**
 * Botones rápidos. Si el patrón calza con 1 prestación, el botón la agrega directo;
 * si calza con varias, se despliegan como sub-botones.
 * Las prestaciones nuevas que se creen con el mismo inicio aparecen solas en su grupo.
 */
const QUICK: Record<PickerCategory, { label: string; match: RegExp }[]> = {
  general: [
    { label: "Limpieza", match: /^limpieza/ },
    { label: "Destartraje", match: /^destartraje/ },
    { label: "Evaluación", match: /^evaluacion/ },
    { label: "Restauraciones", match: /^(restauracion|reconstruccion dental)/ },
    { label: "Endodoncia", match: /(endodon|^trepanacion)/ },
    { label: "Exodoncia / Cirugía", match: /^(exodoncia|cirugia)/ },
    { label: "Radiografías", match: /^radiografia/ },
    { label: "Coronas", match: /^corona/ },
    { label: "Incrustaciones", match: /^(incrustacion|inlay|onlay)/ },
  ],
  orthodontics: [
    { label: "Control mensual", match: /^control/ },
    { label: "Instalación", match: /^instalacion/ },
    { label: "Estudio", match: /^estudio/ },
    { label: "Retiros", match: /^retiro/ },
    { label: "Contenciones", match: /^contencion/ },
    { label: "Brackets", match: /(reposicion brackets|eliminacion adhesivo)/ },
  ],
  endodontics: [
    { label: "Molar", match: /^endodoncia molar/ },
    { label: "Premolar", match: /^endodoncia pre-?molar/ },
    { label: "Diente anterior", match: /^endodoncia (diente )?anterior/ },
    { label: "Retratamiento", match: /^retratamiento/ },
    { label: "Urgencia / medicación", match: /^(trepanacion|medicacion)/ },
  ],
  aesthetics: [
    { label: "Toxina / Botox", match: /^(toxina|botox)/ },
    { label: "Labios y nariz", match: /^(aumento de labios|rino)/ },
    { label: "Hilos tensores", match: /^hilos/ },
    { label: "Vitaminas", match: /^vitaminas/ },
    { label: "BB Glow", match: /^bb glow/ },
    { label: "Mesoterapia", match: /^mesoterapia/ },
    { label: "Blanqueamiento", match: /^blanqueamiento/ },
    { label: "Carillas", match: /^carilla/ },
  ],
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function TreatmentPicker({
  items,
  category,
  selectedIds,
  onPick,
}: {
  items: TreatmentItem[];
  category: PickerCategory;
  /** Ids ya elegidos (se marcan). En modo visita pueden ser varios. */
  selectedIds: string[];
  onPick: (t: TreatmentItem) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...items].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name))),
    [items]
  );

  const quick = useMemo(
    () =>
      QUICK[category]
        .map((q) => ({ ...q, items: sorted.filter((t) => q.match.test(normalize(t.name))) }))
        .filter((q) => q.items.length > 0),
    [category, sorted]
  );

  const lettersWithItems = useMemo(() => new Set(sorted.map((t) => firstLetter(t.name))), [sorted]);

  const listed = useMemo(() => {
    const q = normalize(query);
    if (q) return sorted.filter((t) => normalize(t.name).includes(q));
    if (letter) return sorted.filter((t) => firstLetter(t.name) === letter);
    return [];
  }, [sorted, query, letter]);

  const chosen = new Set(selectedIds.filter(Boolean));
  const selected = selectedIds.length === 1 ? items.find((t) => t.id === selectedIds[0]) : undefined;

  const pill = (t: TreatmentItem) => (
    <button
      key={t.id}
      type="button"
      onClick={() => onPick(t)}
      className={cn(
        "text-left px-3 py-2 rounded-lg border text-xs transition-colors",
        chosen.has(t.id)
          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
          : "border-border hover:bg-accent"
      )}
    >
      <span className="block font-semibold text-foreground leading-tight">{t.name}</span>
      <span className="text-muted-foreground font-mono">{formatCLP(t.default_price)}</span>
    </button>
  );

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No hay prestaciones en el catálogo para esta categoría. Escribe el tratamiento abajo o agrégalas en Prestaciones.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Botones rápidos */}
      {quick.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-primary" /> Botones rápidos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => {
              const single = q.items.length === 1 ? q.items[0] : null;
              const isOpen = openGroup === q.label;
              const isSelected = single ? chosen.has(single.id) : q.items.some((t) => chosen.has(t.id));
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => (single ? onPick(single) : setOpenGroup(isOpen ? null : q.label))}
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
                    isSelected || isOpen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-accent"
                  )}
                >
                  {q.label}
                  {!single && (
                    <>
                      <span className="opacity-70">({q.items.length})</span>
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {openGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 p-2 rounded-xl bg-muted/40 border border-border">
              {quick.find((q) => q.label === openGroup)?.items.map(pill)}
            </div>
          )}
        </div>
      )}

      {/* Buscador + letras */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLetter(null);
            }}
            placeholder={`Buscar entre ${items.length} prestaciones...`}
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {LETTERS.map((l) => {
            const enabled = lettersWithItems.has(l);
            return (
              <button
                key={l}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  setLetter(letter === l ? null : l);
                  setQuery("");
                }}
                className={cn(
                  "w-7 h-7 rounded-md text-xs font-bold transition-colors",
                  letter === l
                    ? "bg-primary text-primary-foreground"
                    : enabled
                    ? "bg-muted text-foreground hover:bg-accent"
                    : "text-muted-foreground/40 cursor-default"
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
        {(letter || query) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {listed.length ? listed.map(pill) : (
              <p className="text-xs text-muted-foreground col-span-2">Sin resultados.</p>
            )}
          </div>
        )}
      </div>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Seleccionado: <strong className="text-foreground">{selected.name}</strong> · precio base{" "}
          {formatCLP(selected.default_price)} (puedes cambiar el valor abajo)
        </p>
      )}
    </div>
  );
}
