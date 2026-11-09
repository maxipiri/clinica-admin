"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCLP } from "@/lib/utils";
import {
  UserRound,
  PlusCircle,
  Phone,
  Mail,
  Percent,
  CheckCircle2,
  XCircle,
  Edit2,
  Search,
} from "lucide-react";
import {
  createDentist,
  updateDentist,
  toggleDentistActive,
} from "@/app/actions/dentistas";
import type { Dentist } from "@/app/actions/dentistas";

export function DentistasClient({
  dentists = [],
}: {
  dentists?: Dentist[];
}) {
  const router = useRouter();
  const safeDentists = dentists ?? [];
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDentist, setEditingDentist] = useState<Dentist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = safeDentists.filter((d) =>
    (d.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.rut || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditingDentist(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(d: Dentist) {
    setEditingDentist(d);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingDentist(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      let res: { error: string | null };
      if (editingDentist) {
        res = await updateDentist(editingDentist.id, fd);
      } else {
        res = await createDentist(fd);
      }

      if (res.error) {
        setError(res.error);
      } else {
        closeModal();
        router.refresh();
      }
    });
  }

  function handleToggle(d: Dentist) {
    startTransition(async () => {
      await toggleDentistActive(d.id, !d.active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <PlusCircle className="w-4 h-4" />
          Nuevo Dentista
        </button>
      </div>

      {/* Grid de dentistas */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-card border border-border rounded-xl">
          <UserRound className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground text-base">No hay dentistas registrados</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            {search ? "No se encontraron resultados para tu búsqueda." : "Registra a los profesionales que atienden en la clínica y configura sus comisiones."}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg"
            >
              Registrar primer dentista
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className={`p-4 bg-card border rounded-xl flex flex-col justify-between transition-all ${
                d.active ? "border-border shadow-xs" : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {d.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm leading-tight">
                        {d.full_name}
                      </h4>
                      {d.rut && <p className="text-xs text-muted-foreground">{d.rut}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(d)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {d.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{d.phone}</span>
                    </div>
                  )}
                  {d.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{d.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 font-medium text-foreground pt-1">
                    <Percent className="w-3.5 h-3.5 text-primary" />
                    {d.pay_mode === "fixed" ? (
                      <span>
                        Pago fijo: <strong>{formatCLP(d.fixed_fee ?? 0)}</strong> por atención
                      </span>
                    ) : (
                      <span>
                        Comisión: <strong>{d.commission_pct}%</strong> (Base:{" "}
                        {d.commission_base === "net" ? "Neta tras laboratorio" : "Bruta"})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className={`inline-flex items-center gap-1 font-medium ${d.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {d.active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {d.active ? "Activo" : "Inactivo"}
                </span>
                <button
                  onClick={() => handleToggle(d)}
                  disabled={isPending}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {d.active ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl p-6 overflow-hidden">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {editingDentist ? "Editar Dentista" : "Nuevo Dentista"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-800">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nombre completo *
                </label>
                <input
                  name="full_name"
                  type="text"
                  required
                  defaultValue={editingDentist?.full_name ?? ""}
                  placeholder="Ej: Dra. Camila Rojas"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    RUT
                  </label>
                  <input
                    name="rut"
                    type="text"
                    defaultValue={editingDentist?.rut ?? ""}
                    placeholder="12.345.678-9"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Teléfono
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={editingDentist?.phone ?? ""}
                    placeholder="+56 9 1234 5678"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Correo electrónico
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingDentist?.email ?? ""}
                  placeholder="camila@clinicadental.cl"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    % Comisión *
                  </label>
                  <input
                    name="commission_pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    defaultValue={editingDentist?.commission_pct ?? 50}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Base de cálculo *
                  </label>
                  <select
                    name="commission_base"
                    defaultValue={editingDentist?.commission_base ?? "gross"}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="gross">Bruta (cobrado)</option>
                    <option value="net">Neta (descuenta lab)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Forma de pago *
                  </label>
                  <select
                    name="pay_mode"
                    defaultValue={editingDentist?.pay_mode ?? "commission"}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="commission">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo por atención</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Monto fijo (CLP)
                  </label>
                  <input
                    name="fixed_fee"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingDentist?.fixed_fee ?? ""}
                    placeholder="Ej: 250000 (implantólogo)"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Es el valor por defecto. En cada atención se puede cambiar según el trato.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : editingDentist ? "Guardar cambios" : "Crear dentista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
