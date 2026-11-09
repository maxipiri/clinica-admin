"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Check, X, PlusCircle, EyeOff, Eye } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import type { TreatmentItem, TreatmentCategory } from "@/app/actions/atenciones";
import { createCatalogItem, updateCatalogItem, toggleCatalogItem } from "@/app/actions/prestaciones";
import { CATEGORIES } from "@/app/atenciones/categories";
import { normalize, firstLetter } from "@/app/atenciones/TreatmentPicker";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const inputCls =
  "w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm";

type Draft = { name: string; default_price: string; lab_cost: string; category: TreatmentCategory };

const toDraft = (t: TreatmentItem): Draft => ({
  name: t.name,
  default_price: String(t.default_price),
  lab_cost: String(t.lab_cost ?? 0),
  category: t.category,
});

const fromDraft = (d: Draft) => ({
  name: d.name,
  default_price: Number(d.default_price) || 0,
  lab_cost: Number(d.lab_cost) || 0,
  category: d.category,
});

export function PrestacionesClient({ items }: { items: TreatmentItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [cat, setCat] = useState<TreatmentCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>({
    name: "",
    default_price: "",
    lab_cost: "0",
    category: "general",
  });

  const base = useMemo(
    () =>
      items
        .filter((t) => (showInactive ? true : t.active))
        .filter((t) => (cat === "all" ? true : t.category === cat))
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name))),
    [items, showInactive, cat]
  );
  const letters = useMemo(() => new Set(base.map((t) => firstLetter(t.name))), [base]);
  const visible = useMemo(() => {
    const q = normalize(query);
    if (q) return base.filter((t) => normalize(t.name).includes(q));
    if (letter) return base.filter((t) => firstLetter(t.name) === letter);
    return base;
  }, [base, query, letter]);

  function run(fn: () => Promise<{ error: string | null }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-medium border border-rose-200">
          {error}
        </div>
      )}

      {/* Barra superior */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLetter(null);
            }}
            placeholder="Buscar prestación..."
            className={cn(inputCls, "pl-9 py-2")}
          />
        </div>
        <button
          type="button"
          onClick={() => setNewOpen((v) => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95"
        >
          <PlusCircle className="w-4 h-4" />
          Nueva prestación
        </button>
      </div>

      {/* Nueva prestación */}
      {newOpen && (
        <div className="p-4 bg-card border border-border rounded-xl grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_160px_auto] gap-2 items-end">
          <div>
            <label className="text-xs font-semibold">Nombre</label>
            <input
              className={inputCls}
              value={newDraft.name}
              onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
              placeholder="Ej: Limpieza promoción"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Precio</label>
            <input
              className={cn(inputCls, "font-mono")}
              type="number"
              min="0"
              value={newDraft.default_price}
              onChange={(e) => setNewDraft({ ...newDraft, default_price: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Costo lab</label>
            <input
              className={cn(inputCls, "font-mono")}
              type="number"
              min="0"
              value={newDraft.lab_cost}
              onChange={(e) => setNewDraft({ ...newDraft, lab_cost: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Categoría</label>
            <select
              className={inputCls}
              value={newDraft.category}
              onChange={(e) => setNewDraft({ ...newDraft, category: e.target.value as TreatmentCategory })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => createCatalogItem(fromDraft(newDraft)),
                () => {
                  setNewDraft({ name: "", default_price: "", lab_cost: "0", category: newDraft.category });
                  setNewOpen(false);
                }
              )
            }
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}

      {/* Filtros: categoría y letras */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[{ key: "all" as const, plural: "Todas" }, ...CATEGORIES].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={cn(
              "px-3 py-1.5 rounded-full border font-semibold",
              cat === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
            )}
          >
            {c.plural}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar ocultas
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setLetter(null)}
          className={cn(
            "px-2 h-7 rounded-md text-xs font-bold",
            !letter ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
          )}
        >
          Todas
        </button>
        {LETTERS.map((l) => {
          const enabled = letters.has(l);
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
                "w-7 h-7 rounded-md text-xs font-bold",
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

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="hidden sm:grid grid-cols-[1fr_130px_130px_120px_96px] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>Prestación ({visible.length})</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Costo lab</span>
          <span>Categoría</span>
          <span />
        </div>
        {visible.map((t) => {
          const isEditing = editingId === t.id && draft;
          const catLabel = CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category;
          return (
            <div
              key={t.id}
              className={cn(
                "grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_120px_96px] gap-2 px-4 py-2.5 items-center text-sm",
                !t.active && "opacity-50"
              )}
            >
              {isEditing ? (
                <>
                  <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <input
                    className={cn(inputCls, "font-mono text-right")}
                    type="number"
                    min="0"
                    value={draft.default_price}
                    onChange={(e) => setDraft({ ...draft, default_price: e.target.value })}
                    autoFocus
                  />
                  <input
                    className={cn(inputCls, "font-mono text-right")}
                    type="number"
                    min="0"
                    value={draft.lab_cost}
                    onChange={(e) => setDraft({ ...draft, lab_cost: e.target.value })}
                  />
                  <select
                    className={inputCls}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as TreatmentCategory })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => updateCatalogItem(t.id, fromDraft(draft)), () => setEditingId(null))}
                      className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                      title="Guardar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-md border border-border hover:bg-accent"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{t.name}</span>
                  <span className="sm:text-right font-mono font-semibold">{formatCLP(t.default_price)}</span>
                  <span className="sm:text-right font-mono text-muted-foreground">
                    {t.lab_cost ? formatCLP(t.lab_cost) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{catLabel}</span>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(t.id);
                        setDraft(toDraft(t));
                        setError(null);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
                      title="Editar precio / nombre"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => toggleCatalogItem(t.id, !t.active))}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      title={t.active ? "Ocultar del catálogo" : "Volver a mostrar"}
                    >
                      {t.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados.</p>}
      </div>
    </div>
  );
}
