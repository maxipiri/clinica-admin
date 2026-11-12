"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Check, X, PlusCircle, Pause, Play, Download } from "lucide-react";
import { Monto, OjoMonto } from "@/components/MontosPrivados";
import { cn } from "@/lib/utils";
import {
  loadRecurringExpenses,
  saveRecurringExpense,
  toggleRecurringExpense,
  type RecurringExpense,
} from "@/app/actions/resumen";

const inputCls =
  "w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm";

export function GastosFijosClient({
  month,
  monthName,
  items,
}: {
  month: string;
  monthName: string;
  items: RecurringExpense[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; name: string; amount: string } | null>(null);

  const pending = items.filter((i) => i.active && !i.loaded);
  const pendingTotal = pending.reduce((s, i) => s + i.amount, 0);

  function run(fn: () => Promise<{ error: string | null; loaded?: number }>, ok?: (r: { loaded?: number }) => void) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        ok?.(res);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 className="font-bold text-foreground flex items-center gap-1">Gastos fijos <OjoMonto k="fijos" /></h2>
        <button
          type="button"
          onClick={() => setEditing({ name: "", amount: "" })}
          className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-rose-600">{error}</p>}
      {info && <p className="px-4 pt-3 text-xs text-emerald-600">{info}</p>}

      <div className="divide-y divide-border">
        {editing && !editing.id && (
          <EditRow
            value={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={() =>
              run(
                () => saveRecurringExpense({ name: editing.name, amount: Number(editing.amount) }),
                () => setEditing(null)
              )
            }
            disabled={isPending}
          />
        )}
        {items.map((i) =>
          editing?.id === i.id ? (
            <EditRow
              key={i.id}
              value={editing}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSave={() =>
                run(
                  () => saveRecurringExpense({ id: i.id, name: editing.name, amount: Number(editing.amount) }),
                  () => setEditing(null)
                )
              }
              disabled={isPending}
            />
          ) : (
            <div key={i.id} className={cn("px-4 py-2.5 flex items-center justify-between gap-2 text-sm", !i.active && "opacity-50")}>
              <div>
                <p className="font-medium text-foreground">{i.name}</p>
                <p className="text-xs">
                  {!i.active ? (
                    <span className="text-muted-foreground">Pausado</span>
                  ) : i.loaded ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Cargado en {monthName}
                    </span>
                  ) : (
                    <span className="text-amber-600">Falta cargar en {monthName}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono font-semibold mr-1"><Monto k="fijos" value={i.amount} /></span>
                <button
                  type="button"
                  onClick={() => setEditing({ id: i.id, name: i.name, amount: String(i.amount) })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => toggleRecurringExpense(i.id, !i.active))}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  title={i.active ? "Pausar" : "Reactivar"}
                >
                  {i.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )
        )}
        {items.length === 0 && !editing && (
          <p className="px-4 py-4 text-xs text-muted-foreground">Agrega gastos que se repiten cada mes (arriendo, luz, internet...).</p>
        )}
      </div>

      {pending.length > 0 && (
        <div className="p-3 border-t border-border">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => loadRecurringExpenses(month),
                (r) => setInfo(`Se cargaron ${r.loaded ?? 0} gastos en la caja (${monthName}).`)
              )
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Cargar {pending.length} gasto{pending.length > 1 ? "s" : ""} fijo{pending.length > 1 ? "s" : ""} en {monthName} (
            <Monto k="fijos" value={pendingTotal} />)
          </button>
        </div>
      )}
    </div>
  );
}

function EditRow({
  value,
  onChange,
  onSave,
  onCancel,
  disabled,
}: {
  value: { id?: string; name: string; amount: string };
  onChange: (v: { id?: string; name: string; amount: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-2">
      <input
        className={inputCls}
        placeholder="Nombre (ej: Luz)"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        autoFocus
      />
      <input
        className={cn(inputCls, "font-mono w-32")}
        type="number"
        min="1"
        placeholder="Monto"
        value={value.amount}
        onChange={(e) => onChange({ ...value, amount: e.target.value })}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onSave}
        className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        title="Guardar"
      >
        <Check className="w-4 h-4" />
      </button>
      <button type="button" onClick={onCancel} className="p-1.5 rounded-md border border-border hover:bg-accent" title="Cancelar">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
