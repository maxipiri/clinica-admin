"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  PlusCircle,
  Search,
  Phone,
  Mail,
  FileText,
  Edit2,
  FolderOpen,
} from "lucide-react";
import { createPatient, updatePatient } from "@/app/actions/pacientes";
import type { Patient } from "@/app/actions/pacientes";

export function PacientesClient({
  patients = [],
}: {
  patients?: Patient[];
}) {
  const router = useRouter();
  const safePatients = patients ?? [];
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = safePatients.filter((p) =>
    (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.rut || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.phone || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditingPatient(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: Patient) {
    setEditingPatient(p);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPatient(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      let res: { error: string | null };
      if (editingPatient) {
        res = await updatePatient(editingPatient.id, fd);
      } else {
        res = await createPatient(fd);
      }

      if (res.error) {
        setError(res.error);
      } else {
        closeModal();
        router.refresh();
      }
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
            placeholder="Buscar por nombre, RUT o teléfono..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <PlusCircle className="w-4 h-4" />
          Nuevo Paciente
        </button>
      </div>

      {/* Listado de pacientes */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-card border border-border rounded-xl">
          <Users className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground text-base">No hay pacientes registrados</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            {search ? "No se encontraron pacientes para ese criterio." : "Registra las fichas de los pacientes para agendar atenciones y registrar sus pagos."}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg"
            >
              Registrar primer paciente
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {p.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/pacientes/${p.id}`} className="font-semibold text-foreground text-sm hover:text-primary hover:underline">
                      {p.full_name}
                    </Link>
                    {p.rut && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {p.rut}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {p.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </span>
                    )}
                    {p.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {p.email}
                      </span>
                    )}
                    {p.notes && (
                      <span className="flex items-center gap-1 text-foreground/80 italic">
                        <FileText className="w-3 h-3" /> {p.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/pacientes/${p.id}`}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Ver ficha
                </Link>
                <button
                  onClick={() => openEdit(p)}
                  className="px-3 py-1.5 border border-border hover:bg-accent rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
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
              {editingPatient ? "Editar Paciente" : "Nuevo Paciente"}
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
                  defaultValue={editingPatient?.full_name ?? ""}
                  placeholder="Ej: Juan Pérez Morales"
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
                    defaultValue={editingPatient?.rut ?? ""}
                    placeholder="15.678.901-2"
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
                    defaultValue={editingPatient?.phone ?? ""}
                    placeholder="+56 9 8765 4321"
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
                  defaultValue={editingPatient?.email ?? ""}
                  placeholder="juan.perez@gmail.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingPatient?.notes ?? ""}
                  placeholder="Alergias, tratamientos previos, observaciones..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

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
                  {isPending ? "Guardando..." : editingPatient ? "Guardar cambios" : "Crear paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
