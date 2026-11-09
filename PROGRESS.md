# PROGRESS — Clínica Admin

> Actualizado automáticamente al final de cada etapa.  
> Zona horaria: America/Santiago

---

## ✅ Fase 0 — Base del proyecto (COMPLETA)

**Commit:** `feat: fase 0 - scaffolding Next.js 16 + Supabase + Tailwind v4 + layout`

### Hecho
- [x] Proyecto Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- [x] Layout con Sidebar (desktop) y BottomNav (móvil) en español
- [x] Clientes Supabase: `lib/supabase/client.ts` y `lib/supabase/server.ts`
- [x] Carpeta `/supabase/migrations` con README de instrucciones
- [x] `.env.example` y `.env.local` (no subido al repo)
- [x] `.gitignore` correctamente configurado

### Cómo probarlo
```bash
npm run dev
# → Abre http://localhost:3000 y verifica que carga el layout con sidebar
```

---

## 🔄 Fase 1 — Autenticación, clínica y roles (EN PROGRESO)

### ✅ Etapa 1A: Migración SQL (COMPLETA — ejecutada en Supabase)

**Archivo:** `supabase/migrations/20261022_000001_create_clinics_and_profiles.sql`
- Tablas `clinics` y `profiles` con RLS
- Función `my_clinic_id()` y trigger `on_auth_user_created`

### ✅ Etapa 1B: Middleware de protección de rutas (COMPLETA)

**Archivos creados:**
- `middleware.ts` — protege todas las rutas, redirige a `/login` si no hay sesión
- Inyecta `x-pathname` header para que el layout detecte rutas de auth
- `app/layout.tsx` — muestra Sidebar/BottomNav solo fuera de `/login`
- `app/page.tsx` — redirige a `/dashboard` o `/login` según sesión

### ✅ Etapa 1C: Pantalla de login (COMPLETA)

**Archivos creados:**
- `app/login/layout.tsx` — layout limpio sin navegación
- `app/login/page.tsx` — formulario con tabs Login / Registro
  - Validación con react-hook-form + zod
  - Feedback de errores inline y errores de servidor
  - Spinner de carga, diseño premium mobile-first

### Pendiente (espera confirmación)
- [ ] Etapa 1D: ~~Layout separado para zona auth vs dashboard~~ *(incluido en 1B/1C)*
- [ ] Etapa 1E: Logout y redirección (botón en Sidebar/BottomNav)
- [ ] Commit Fase 1

---

## ✅ Módulo Caja (/caja) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000002_create_caja_and_laboratorio.sql`:
  - Tablas: `cash_categories`, `cash_movements`, `cash_closings`.
  - RLS activado con aislamiento por `clinic_id`.
  - Categorías predeterminadas (Arriendo box, Insumos, Servicios, etc.).
- [x] Server Actions en `app/actions/caja.ts`:
  - `getMovementsByDate`: consulta movimientos filtrados por fecha.
  - `getDaySummary`: balance, total ingresos, total egresos y efectivo esperado.
  - `createMovement`: registro de ingresos y egresos (con validación Zod).
  - `voidMovement`: anulación con auditoría (`voided_at` + motivo), sin borrado físico.
  - `closeDayCash`: registro de arqueo/cierre con cálculo de diferencia.
- [x] Interfaz en `app/caja/page.tsx` y `app/caja/CajaClient.tsx`:
  - Selector y navegación por fecha en zona horaria America/Santiago.
  - Tarjetas de resumen del día (Ingresos, Egresos, Balance).
  - Listado de movimientos con categorías y badges de medio de pago.
  - Modal para nuevo movimiento (ingreso / egreso).
  - Modal de arqueo y cierre de caja con cálculo automático de descuadre.
  - Anulación de movimientos con justificación obligatoria.

---

## ✅ Módulo Laboratorio (/laboratorio) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000002_create_caja_and_laboratorio.sql`:
  - Tablas: `labs`, `lab_orders`, `lab_payments`.
  - RLS activado con políticas multi-clínica.
  - Estados de orden: borrador, enviada, recibida, instalada, cancelada.
- [x] Server Actions en `app/actions/laboratorio.ts`:
  - CRUD de laboratorios (`getLabs`, `createLab`, `updateLab`, `toggleLabActive`).
  - Control de órdenes (`getLabOrders`, `createLabOrder`, `updateOrderStatus`, `voidLabOrder`).
  - Cuentas por pagar agrupadas por mes (`getLabBillingSummary`).
  - `payLabMonth`: registro de pago mensual que actualiza órdenes y genera automáticamente el egreso en `cash_movements`.
- [x] Interfaz en `app/laboratorio/page.tsx` y `app/laboratorio/LaboratorioClient.tsx`:
  - Tabs: Órdenes, Cuentas por pagar y Directorio de laboratorios.
  - Métricas rápidas: órdenes activas, atrasadas con alertas visuales y total adeudado.
  - Modal de nueva orden con costos y fechas de entrega esperadas.
  - Modal de actualización de estado del trabajo protésico.
  - Módulo de pago de cuenta mensual integrado con la caja.

---

## ✅ Módulo Dentistas (/dentistas) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000004_create_dentists_patients_appointments_settlements.sql`:
  - Tabla `dentists` con RLS por `clinic_id`.
  - Configuración de porcentaje de comisión y base de cálculo (bruta vs neta tras laboratorio).
- [x] Server Actions en `app/actions/dentistas.ts`:
  - `getDentists`, `createDentist`, `updateDentist`, `toggleDentistActive`.
- [x] Interfaz en `app/dentistas/page.tsx` y `app/dentistas/DentistasClient.tsx`:
  - Búsqueda en vivo por nombre o RUT.
  - Tarjetas con datos de contacto, comisión y estado activo/inactivo.
  - Modal para registro y edición rápida de dentistas.

---

## ✅ Módulo Pacientes (/pacientes) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000004_create_dentists_patients_appointments_settlements.sql`:
  - Tabla `patients` con RLS por `clinic_id` e índices de búsqueda.
- [x] Server Actions en `app/actions/pacientes.ts`:
  - `getPatients`, `createPatient`, `updatePatient`.
- [x] Interfaz en `app/pacientes/page.tsx` y `app/pacientes/PacientesClient.tsx`:
  - Búsqueda por nombre, RUT o teléfono.
  - Ficha de paciente con notas clínicas y datos de contacto.
  - Modal para alta y actualización de pacientes.

---

## ✅ Módulo Atenciones Realizadas (/atenciones) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000004_create_dentists_patients_appointments_settlements.sql`:
  - Tabla `appointments_work` y catálogo de tratamientos `treatments_catalog`.
  - Vinculación a caja: si hay pago o abono inmediato, se registra en `cash_movements`.
- [x] Server Actions en `app/actions/atenciones.ts`:
  - `getTreatmentsCatalog`, `getAppointments`, `createAppointment`, `registerAppointmentPayment`, `voidAppointment`.
- [x] Interfaz en `app/atenciones/page.tsx` y `app/atenciones/AtencionesClient.tsx`:
  - Métricas de total facturado, efectivamente cobrado y saldo pendiente por cobrar.
  - Filtros por dentista y estado de pago (pendiente, abono parcial, pagado).
  - Modal para nueva atención con selección de paciente, dentista tratante y catálogo de tratamientos.
  - Modal para registrar abonos con generación automática de ingreso en la Caja diaria.
  - Auditoría y anulación con motivo obligatorio.

---

## ✅ Módulo Liquidaciones (/liquidaciones) — COMPLETO

### Hecho
- [x] Migración SQL `supabase/migrations/20261023_000004_create_dentists_patients_appointments_settlements.sql`:
  - Tablas `dentist_settlements` y `dentist_settlement_items`.
  - Estados: borrador (`draft`), pagada (`paid`).
- [x] Server Actions en `app/actions/liquidaciones.ts`:
  - `getSettlements`: listado de liquidaciones históricas.
  - `calculateSettlementPreview`: cálculo automático del período según atenciones cobradas del dentista y descuento de costos de laboratorio si la comisión es sobre base neta.
  - `saveSettlementDraft`: guarda o actualiza la liquidación mensual.
  - `paySettlement`: liquida honorarios y genera automáticamente el egreso en `cash_movements` bajo "Remuneraciones / comisiones".
- [x] Interfaz en `app/liquidaciones/page.tsx` y `app/liquidaciones/LiquidacionesClient.tsx`:
  - Calculadora mensual por dentista con desglose interactivo de tratamientos.
  - Historial de liquidaciones con badges de estado y acción de pago directo a caja.

---

## ⏳ Próximas fases

| Fase | Descripción |
|------|-------------|
| 7 | Reportes consolidados y gráficos de dashboard |
| 8 | Pulido general, seguridad final y deploy a producción |
