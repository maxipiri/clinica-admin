"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, UserPlus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPatient } from "@/app/actions/pacientes";
import type { Patient } from "@/app/actions/pacientes";
import { normalize } from "./TreatmentPicker";

const inputCls =
  "w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm";

/**
 * Buscador de pacientes por nombre, RUT o teléfono, con alta rápida
 * ("+ Nuevo paciente") sin salir del formulario de la atención.
 */
export function PatientPicker({
  patients,
  value,
  onChange,
}: {
  patients: Patient[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [created, setCreated] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", rut: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const all = useMemo(() => [...created, ...patients], [created, patients]);
  const selected = all.find((p) => p.id === value);

  const results = useMemo(() => {
    const q = normalize(query);
    const qDigits = query.replace(/\D/g, "");
    const list = q
      ? all.filter(
          (p) =>
            normalize(p.full_name).includes(q) ||
            (qDigits.length >= 3 &&
              ((p.rut ?? "").replace(/\D/g, "").includes(qDigits) ||
                (p.phone ?? "").replace(/\D/g, "").includes(qDigits)))
        )
      : all;
    return list.slice(0, 8);
  }, [all, query]);

  function startCreate() {
    setCreating(true);
    setOpen(false);
    setError(null);
    // Si escribió un nombre en el buscador, se usa como punto de partida
    setForm({ full_name: /\d/.test(query) ? "" : query.trim(), rut: "", phone: /\d/.test(query) ? query.trim() : "" });
  }

  function saveNew() {
    const fd = new FormData();
    fd.set("full_name", form.full_name);
    fd.set("rut", form.rut);
    fd.set("phone", form.phone);
    setError(null);
    startTransition(async () => {
      const res = await createPatient(fd);
      if (res.error || !res.id) {
        setError(res.error ?? "No se pudo crear el paciente");
        return;
      }
      const p: Patient = {
        id: res.id,
        full_name: form.full_name.trim(),
        rut: form.rut.trim() || null,
        phone: form.phone.trim() || null,
        email: null,
        notes: null,
        created_at: new Date().toISOString(),
      };
      setCreated((c) => [p, ...c]);
      onChange(p.id);
      setCreating(false);
      setQuery("");
    });
  }

  return (
    <div className="relative">
      <input type="hidden" name="patient_id" value={value} />

      {creating ? (
        <div className="p-3 rounded-xl border border-primary/40 bg-primary/5 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-primary" /> Nuevo paciente
          </p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <input
            className={inputCls}
            placeholder="Nombre completo *"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              placeholder="RUT"
              value={form.rut}
              onChange={(e) => setForm({ ...form, rut: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Teléfono (WhatsApp)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || !form.full_name.trim()}
              onClick={saveNew}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {isPending ? "Guardando..." : "Crear y seleccionar"}
            </button>
          </div>
        </div>
      ) : selected ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-primary/40 bg-primary/5">
          <div className="text-sm">
            <span className="font-semibold text-foreground">{selected.full_name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {[selected.rut, selected.phone].filter(Boolean).join(" · ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(true);
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Cambiar paciente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Buscar por nombre, RUT o teléfono..."
              className={cn(inputCls, "pl-8")}
            />
          </div>
          {open && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                >
                  <span className="font-medium text-foreground">{p.full_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {[p.rut, p.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No se encontró ningún paciente.</p>
              )}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startCreate}
                className="w-full text-left px-3 py-2 border-t border-border text-sm font-semibold text-primary hover:bg-accent inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                Nuevo paciente{query.trim() && !/\d/.test(query) ? `: "${query.trim()}"` : ""}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={startCreate}
            className="mt-1 text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
          >
            <UserPlus className="w-3.5 h-3.5" /> Nuevo paciente
          </button>
        </>
      )}
    </div>
  );
}
