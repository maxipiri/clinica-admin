/**
 * Se muestra al instante al cambiar de sección, mientras llegan los datos.
 * Así la app responde al toque en vez de quedarse "pegada".
 */
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-7 w-40 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between gap-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
