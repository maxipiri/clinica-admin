# Sistema de Administración para Clínica Dental

Documento maestro para trabajar con Antigravity. Contiene: (1) el prompt inicial, (2) decisiones de negocio por confirmar, (3) modelo de datos, (4) fases con prompts listos para pegar.

---

## 0. Cómo usarlo

1. Crea un repositorio vacío en GitHub (ej: `clinica-admin`) y clónalo.
2. Abre la carpeta en Antigravity.
3. Guarda este archivo en la raíz como `SPEC.md`.
4. Crea un archivo `AGENTS.md` en la raíz (o en las Rules de Antigravity) con el bloque "Reglas permanentes" de la sección 1.
5. Pega el prompt de cada fase **una por una**, en modo Planning. Revisa el plan, aprueba, prueba el resultado y recién ahí pasa a la siguiente fase.
6. Conecta Supabase (MCP o CLI) y Vercel (importar el repo de GitHub) en la Fase 0.

---

## 1. Prompt inicial (pegar en Antigravity)

```
Vamos a construir una aplicación web para administrar mi clínica dental.
Lee SPEC.md completo antes de hacer cualquier cosa. Trabajaremos por fases:
no avances a la siguiente fase sin que yo lo apruebe.

Stack:
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres, Auth, Row Level Security)
- Deploy en Vercel, código en GitHub
- Formularios con react-hook-form + zod

Antes de escribir código, entrégame un plan de la Fase 0.
```

### Reglas permanentes (AGENTS.md)

```
- Idioma de la interfaz: español (Chile). Código y nombres de tablas en inglés o español consistente (elegir uno y mantenerlo).
- Moneda: CLP, enteros, sin decimales. Guardar montos como integer. Formato $1.234.567.
- Fechas: zona horaria America/Santiago.
- Toda tabla de negocio lleva clinic_id (preparado para multi-clínica y monetización futura) y created_at / updated_at.
- Row Level Security activo en TODAS las tablas. Un usuario solo ve datos de su clínica.
- Todos los cambios de base de datos van como migraciones SQL versionadas en /supabase/migrations. Nunca modificar la BD "a mano".
- Nunca borrar datos financieros: usar anulación (voided_at + motivo) para mantener auditoría.
- Nunca poner claves secretas en el repo. Usar .env.local y variables de entorno en Vercel.
- Diseño mobile-first: debe usarse cómodo desde el celular en el box.
- Cada fase termina con: lista de lo hecho, cómo probarlo y commit en GitHub.
```

---

## 2. Decisiones de negocio por confirmar

Estas reglas cambian los cálculos. Antes de la Fase 4, definir:

| # | Pregunta | Opciones |
|---|----------|----------|
| 1 | ¿El % del dentista se calcula sobre el monto cobrado o sobre el monto neto (descontando el costo de laboratorio)? | Bruto / Neto / Configurable por dentista |
| 2 | ¿El % se paga sobre lo **facturado** o solo sobre lo **efectivamente cobrado** al paciente? | Facturado / Cobrado |
| 3 | ¿Quién asume el costo de la prótesis: la clínica, el dentista o se reparte? | Clínica / Dentista / % compartido |
| 4 | ¿Cada dentista tiene un % único o varía por tipo de tratamiento? | Único / Por tratamiento |
| 5 | ¿Los pagos a laboratorio se hacen por mes cerrado, por orden o por laboratorio? | Mensual por laboratorio (recomendado) |
| 6 | ¿Los pacientes pagan en cuotas o abonos? | Sí / No |
| 7 | ¿Medios de pago a registrar? | Efectivo, transferencia, débito, crédito, otros |
| 8 | ¿Cuántos usuarios usarán el sistema y con qué permisos? | Admin (tú), recepción, dentistas (solo ver su liquidación) |

---

## 3. Módulos

1. **Autenticación y roles**: admin, recepción, dentista.
2. **Dentistas**: datos, % de comisión, estado activo.
3. **Pacientes**: datos básicos (nombre, RUT, teléfono). Sin ficha clínica por ahora.
4. **Atenciones / tratamientos realizados**: fecha, paciente, dentista, tratamiento, monto, estado de pago.
5. **Laboratorio y prótesis**: órdenes de trabajo, estados, costo, cuenta por pagar mensual a cada laboratorio.
6. **Caja diaria**: ingresos y egresos del día, categorías, medio de pago, cierre de caja.
7. **Liquidación de dentistas**: cálculo mensual según %, detalle de atenciones, descuentos, estado pagado/pendiente.
8. **Reportes**: ingresos vs egresos por mes, ranking por dentista, prótesis pendientes, cuentas por pagar.

---

## 4. Modelo de datos inicial

```
clinics            (id, name, created_at)
profiles           (id → auth.users, clinic_id, full_name, role: admin|reception|dentist)

dentists           (id, clinic_id, profile_id?, full_name, rut, phone,
                    commission_pct numeric(5,2), commission_base: gross|net,
                    active boolean)

patients           (id, clinic_id, full_name, rut, phone, email, notes)

treatments_catalog (id, clinic_id, name, default_price int, active)

appointments_work  -- "atenciones realizadas"
                   (id, clinic_id, date, patient_id, dentist_id, treatment_id?,
                    description, amount int, paid_amount int,
                    payment_status: pending|partial|paid, voided_at?, void_reason?)

labs               (id, clinic_id, name, contact, phone, active)

lab_orders         -- prótesis
                   (id, clinic_id, lab_id, patient_id, dentist_id, work_id?,
                    type, description, sent_date, due_date, received_date?,
                    installed_date?, status: draft|sent|received|installed|cancelled,
                    lab_cost int, charged_to_patient int,
                    billing_month date,  -- mes en que se paga al laboratorio
                    lab_paid boolean, lab_paid_at?)

lab_payments       (id, clinic_id, lab_id, month date, total int, paid_at, method, notes)

cash_categories    (id, clinic_id, name, type: income|expense)
cash_movements     (id, clinic_id, date, type: income|expense, category_id,
                    amount int, payment_method, description,
                    work_id?, lab_order_id?, dentist_settlement_id?,
                    created_by, voided_at?, void_reason?)
cash_closings      (id, clinic_id, date, expected_cash int, counted_cash int,
                    difference int, closed_by, notes)

dentist_settlements (id, clinic_id, dentist_id, month date, gross_total int,
                     lab_discounts int, commission_pct numeric, amount_due int,
                     status: draft|approved|paid, paid_at?)
dentist_settlement_items (id, settlement_id, work_id, base_amount int,
                          commission_amount int)
```

Relaciones clave:
- Un pago de paciente genera un `cash_movement` de ingreso.
- El pago a un laboratorio genera un `cash_movement` de egreso y marca las `lab_orders` del mes como pagadas.
- El pago a un dentista genera un `cash_movement` de egreso y cierra la liquidación.

---

## 5. Fases con prompts

### Fase 0 — Base del proyecto
```
Fase 0. Crea el proyecto Next.js con TypeScript, Tailwind y shadcn/ui.
Configura:
- Cliente de Supabase (server y client) con variables de entorno.
- Layout con menú lateral (desktop) y menú inferior (móvil) en español.
- Carpeta /supabase/migrations y un README con instrucciones de arranque.
- .env.example.
Haz commit y deja listo para importar en Vercel.
Dime exactamente qué debo hacer yo en Supabase y Vercel (crear proyecto,
copiar URL y anon key, variables de entorno).
```

### Fase 1 — Autenticación, clínica y roles
```
Fase 1. Implementa login con email/contraseña usando Supabase Auth.
Crea las tablas clinics y profiles, con RLS por clinic_id y roles
(admin, reception, dentist). Al registrarse el primer usuario se crea su clínica
y queda como admin. Protege las rutas. Entrega migración SQL y pantalla de login.
```

### Fase 2 — Dentistas, pacientes y catálogo
```
Fase 2. CRUD de dentistas (con % de comisión y base de cálculo),
pacientes y catálogo de tratamientos. Tablas con búsqueda, formularios validados
con zod, RLS. Mobile-first.
```

### Fase 3 — Caja diaria (ingresos y egresos)
```
Fase 3. Módulo de caja diaria: registrar ingresos y egresos con categoría,
medio de pago y descripción; vista del día con totales por medio de pago,
navegación entre fechas, anulación (no borrado) con motivo, y cierre de caja
(efectivo esperado vs contado, diferencia). Categorías precargadas editables.
```

### Fase 4 — Atenciones realizadas
```
Fase 4. Registro de atenciones: fecha, paciente, dentista, tratamiento, monto.
Pagos y abonos del paciente (parciales permitidos) que generan automáticamente
un ingreso en caja. Estado de pago. Lista filtrable por fecha, dentista y estado.
```

### Fase 5 — Laboratorio y prótesis
```
Fase 5. Módulo de laboratorios y órdenes de prótesis con estados
(borrador, enviada, recibida, instalada, cancelada), fecha de entrega
comprometida y alertas de atrasadas. Cada orden tiene costo del laboratorio y
mes de facturación. Vista "Cuenta por pagar por laboratorio y mes" con detalle
y total. Acción "Registrar pago al laboratorio" que marca las órdenes del mes
como pagadas y crea el egreso en caja.
```

### Fase 6 — Liquidación de dentistas
```
Fase 6. Liquidación mensual por dentista según las reglas definidas en SPEC.md
sección 2 (usa las decisiones que te confirmaré). Genera borrador con detalle por
atención, permite ajustes manuales, aprobar y marcar como pagado (crea egreso en caja).
Exportable a PDF. Un dentista solo ve su propia liquidación.
```

### Fase 7 — Reportes y dashboard
```
Fase 7. Dashboard con: ingresos y egresos del mes, utilidad, prótesis pendientes
y atrasadas, cuentas por pagar a laboratorios, comisiones pendientes.
Gráficos simples por mes y por dentista. Exportar a Excel/CSV.
```

### Fase 8 — Pulido y despliegue
```
Fase 8. Revisión de seguridad (RLS en todas las tablas, sin claves expuestas),
manejo de errores, estados de carga, pruebas de los cálculos de comisión y caja,
respaldo de datos y documentación. Deploy final en Vercel con dominio.
```

---

## 6. Para monetizar más adelante

Por esto el diseño ya incluye `clinic_id` en todo: más adelante solo se agregan planes de suscripción (Stripe/Flow/Mercado Pago), onboarding de nuevas clínicas y una página de precios, sin rehacer la base de datos.

## 7. Datos personales

Los RUT y datos de pacientes son datos personales. Mantén RLS estricto, no los expongas en logs ni URLs, y considera la Ley 19.628 (y la nueva ley de protección de datos personales de Chile) antes de ofrecerlo a terceros.
