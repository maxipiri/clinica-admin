"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";

/**
 * Ojo para ocultar/mostrar montos (como en las apps del banco).
 * Cada bloque tiene su propia llave y un botón general oculta o muestra todo.
 * La elección se recuerda en este navegador.
 */

type Ctx = {
  isHidden: (k: string) => boolean;
  toggle: (k: string) => void;
  allHidden: boolean;
  toggleAll: () => void;
};

const MontosCtx = createContext<Ctx | null>(null);

export function MontosProvider({
  storageKey,
  keys,
  children,
}: {
  storageKey: string;
  keys: string[];
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setHidden(JSON.parse(saved));
    } catch {
      /* sin almacenamiento disponible: se muestran todos */
    }
  }, [storageKey]);

  function save(next: Record<string, boolean>) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignorar */
    }
    return next;
  }

  const allHidden = keys.every((k) => hidden[k]);

  const value: Ctx = {
    isHidden: (k) => !!hidden[k],
    toggle: (k) => setHidden((h) => save({ ...h, [k]: !h[k] })),
    allHidden,
    toggleAll: () => setHidden(() => save(Object.fromEntries(keys.map((k) => [k, !allHidden])))),
  };

  return <MontosCtx.Provider value={value}>{children}</MontosCtx.Provider>;
}

export function useMontos(): Ctx {
  return (
    useContext(MontosCtx) ?? {
      isHidden: () => false,
      toggle: () => {},
      allHidden: false,
      toggleAll: () => {},
    }
  );
}

/** Muestra un monto en pesos, o "$ ••••••" si su bloque está oculto. */
export function Monto({ k, value, negative = false }: { k: string; value: number; negative?: boolean }) {
  const { isHidden } = useMontos();
  if (isHidden(k)) return <>$ ••••••</>;
  return <>{negative ? `−${formatCLP(Math.abs(value))}` : formatCLP(value || 0)}</>;
}

/** Botón de ojo para un bloque. */
export function OjoMonto({ k, className }: { k: string; className?: string }) {
  const { isHidden, toggle } = useMontos();
  const hidden = isHidden(k);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(k);
      }}
      className={cn("p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent", className)}
      title={hidden ? "Mostrar montos" : "Ocultar montos"}
      aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
    >
      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

/** Botón general: oculta o muestra todos los montos de la página. */
export function OjoTodos({ className }: { className?: string }) {
  const { allHidden, toggleAll } = useMontos();
  return (
    <button
      type="button"
      onClick={toggleAll}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent",
        className
      )}
      title={allHidden ? "Mostrar todos los montos" : "Ocultar todos los montos"}
    >
      {allHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      {allHidden ? "Mostrar montos" : "Ocultar montos"}
    </button>
  );
}
