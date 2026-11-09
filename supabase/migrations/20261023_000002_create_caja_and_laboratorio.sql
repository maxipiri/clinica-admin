-- ============================================================
-- Migración: Caja diaria + Laboratorio y prótesis
-- Fecha: 2026-10-23
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extensiones
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================
-- MÓDULO CAJA
-- ============================================================

-- ------------------------------------------------------------
-- 2. Categorías de caja (ingresos / egresos)
-- ------------------------------------------------------------
create table if not exists public.cash_categories (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    name        text not null,
    type        text not null check (type in ('income', 'expense')),
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index idx_cash_categories_clinic on public.cash_categories(clinic_id);

-- ------------------------------------------------------------
-- 3. Movimientos de caja
-- ------------------------------------------------------------
create table if not exists public.cash_movements (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    date            date not null,
    type            text not null check (type in ('income', 'expense')),
    category_id     uuid references public.cash_categories(id),
    amount          integer not null check (amount > 0),
    payment_method  text not null check (payment_method in ('cash', 'transfer', 'debit', 'credit', 'other')),
    description     text not null,
    -- Referencias opcionales a otros módulos
    lab_order_id            uuid,   -- FK se agrega después de crear la tabla
    dentist_settlement_id   uuid,
    -- Auditoría
    created_by      uuid references auth.users(id),
    voided_at       timestamptz,
    void_reason     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_cash_movements_clinic_date on public.cash_movements(clinic_id, date);
create index idx_cash_movements_clinic_type on public.cash_movements(clinic_id, type);

-- ------------------------------------------------------------
-- 4. Cierres de caja
-- ------------------------------------------------------------
create table if not exists public.cash_closings (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    date            date not null,
    expected_cash   integer not null default 0,
    counted_cash    integer not null default 0,
    difference      integer generated always as (counted_cash - expected_cash) stored,
    notes           text,
    closed_by       uuid references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (clinic_id, date)
);

create index idx_cash_closings_clinic_date on public.cash_closings(clinic_id, date);

-- ============================================================
-- MÓDULO LABORATORIO
-- ============================================================

-- ------------------------------------------------------------
-- 5. Laboratorios
-- ------------------------------------------------------------
create table if not exists public.labs (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    name        text not null,
    contact     text,
    phone       text,
    email       text,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index idx_labs_clinic on public.labs(clinic_id);

-- ------------------------------------------------------------
-- 6. Órdenes de laboratorio (prótesis)
-- ------------------------------------------------------------
create table if not exists public.lab_orders (
    id                  uuid primary key default gen_random_uuid(),
    clinic_id           uuid not null references public.clinics(id) on delete cascade,
    lab_id              uuid not null references public.labs(id),
    -- Referencias opcionales a paciente/dentista (tablas creadas en Fase 2)
    patient_name        text not null,           -- desnormalizado por ahora
    dentist_name        text not null,           -- desnormalizado por ahora
    -- Descripción del trabajo
    work_type           text not null,           -- tipo de prótesis
    description         text,
    -- Fechas
    sent_date           date not null default current_date,
    due_date            date,
    received_date       date,
    installed_date      date,
    -- Estado
    status              text not null default 'draft'
                        check (status in ('draft','sent','received','installed','cancelled')),
    -- Costos
    lab_cost            integer not null default 0 check (lab_cost >= 0),
    charged_to_patient  integer not null default 0 check (charged_to_patient >= 0),
    -- Facturación al laboratorio
    billing_month       date,                    -- mes en que se paga al lab (ej: 2026-10-01)
    lab_paid            boolean not null default false,
    lab_paid_at         timestamptz,
    -- Auditoría
    voided_at           timestamptz,
    void_reason         text,
    created_by          uuid references auth.users(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_lab_orders_clinic on public.lab_orders(clinic_id);
create index idx_lab_orders_lab    on public.lab_orders(lab_id);
create index idx_lab_orders_status on public.lab_orders(clinic_id, status);
create index idx_lab_orders_billing on public.lab_orders(clinic_id, billing_month, lab_paid);

-- FK diferida a cash_movements (tabla ya existe)
alter table public.cash_movements
    add column if not exists lab_order_id uuid references public.lab_orders(id);

-- ------------------------------------------------------------
-- 7. Pagos a laboratorios
-- ------------------------------------------------------------
create table if not exists public.lab_payments (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    lab_id      uuid not null references public.labs(id),
    month       date not null,    -- primer día del mes, ej: 2026-10-01
    total       integer not null check (total > 0),
    paid_at     timestamptz not null default now(),
    method      text not null check (method in ('cash', 'transfer', 'debit', 'credit', 'other')),
    notes       text,
    -- Referencia al egreso en caja
    cash_movement_id uuid references public.cash_movements(id),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (clinic_id, lab_id, month)
);

create index idx_lab_payments_clinic on public.lab_payments(clinic_id);
create index idx_lab_payments_lab    on public.lab_payments(lab_id, month);

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================
-- (La función set_updated_at ya existe desde la migración anterior)

create trigger cash_categories_updated_at
    before update on public.cash_categories
    for each row execute function public.set_updated_at();

create trigger cash_movements_updated_at
    before update on public.cash_movements
    for each row execute function public.set_updated_at();

create trigger cash_closings_updated_at
    before update on public.cash_closings
    for each row execute function public.set_updated_at();

create trigger labs_updated_at
    before update on public.labs
    for each row execute function public.set_updated_at();

create trigger lab_orders_updated_at
    before update on public.lab_orders
    for each row execute function public.set_updated_at();

create trigger lab_payments_updated_at
    before update on public.lab_payments
    for each row execute function public.set_updated_at();

-- ============================================================
-- 9. Row Level Security
-- ============================================================

alter table public.cash_categories enable row level security;
alter table public.cash_movements  enable row level security;
alter table public.cash_closings   enable row level security;
alter table public.labs            enable row level security;
alter table public.lab_orders      enable row level security;
alter table public.lab_payments    enable row level security;

-- ── cash_categories ──────────────────────────────────────────
create policy "cash_categories: ver de mi clínica"
    on public.cash_categories for select
    using (clinic_id = public.my_clinic_id());

create policy "cash_categories: insertar en mi clínica"
    on public.cash_categories for insert
    with check (clinic_id = public.my_clinic_id());

create policy "cash_categories: actualizar en mi clínica"
    on public.cash_categories for update
    using (clinic_id = public.my_clinic_id());

-- ── cash_movements ────────────────────────────────────────────
create policy "cash_movements: ver de mi clínica"
    on public.cash_movements for select
    using (clinic_id = public.my_clinic_id());

create policy "cash_movements: insertar en mi clínica"
    on public.cash_movements for insert
    with check (clinic_id = public.my_clinic_id());

create policy "cash_movements: actualizar en mi clínica"
    on public.cash_movements for update
    using (clinic_id = public.my_clinic_id());

-- ── cash_closings ─────────────────────────────────────────────
create policy "cash_closings: ver de mi clínica"
    on public.cash_closings for select
    using (clinic_id = public.my_clinic_id());

create policy "cash_closings: insertar en mi clínica"
    on public.cash_closings for insert
    with check (clinic_id = public.my_clinic_id());

create policy "cash_closings: actualizar en mi clínica"
    on public.cash_closings for update
    using (clinic_id = public.my_clinic_id());

-- ── labs ──────────────────────────────────────────────────────
create policy "labs: ver de mi clínica"
    on public.labs for select
    using (clinic_id = public.my_clinic_id());

create policy "labs: insertar en mi clínica"
    on public.labs for insert
    with check (clinic_id = public.my_clinic_id());

create policy "labs: actualizar en mi clínica"
    on public.labs for update
    using (clinic_id = public.my_clinic_id());

-- ── lab_orders ────────────────────────────────────────────────
create policy "lab_orders: ver de mi clínica"
    on public.lab_orders for select
    using (clinic_id = public.my_clinic_id());

create policy "lab_orders: insertar en mi clínica"
    on public.lab_orders for insert
    with check (clinic_id = public.my_clinic_id());

create policy "lab_orders: actualizar en mi clínica"
    on public.lab_orders for update
    using (clinic_id = public.my_clinic_id());

-- ── lab_payments ──────────────────────────────────────────────
create policy "lab_payments: ver de mi clínica"
    on public.lab_payments for select
    using (clinic_id = public.my_clinic_id());

create policy "lab_payments: insertar en mi clínica"
    on public.lab_payments for insert
    with check (clinic_id = public.my_clinic_id());

create policy "lab_payments: actualizar en mi clínica"
    on public.lab_payments for update
    using (clinic_id = public.my_clinic_id());

-- ============================================================
-- 10. Categorías de caja por defecto
-- ============================================================
-- Se insertan con clinic_id = NULL y se asocian a la primera
-- clínica desde la aplicación. Por ahora, la app las crea al registrarse.
-- (Ver server action: initDefaultCategories en app/actions/caja.ts)
