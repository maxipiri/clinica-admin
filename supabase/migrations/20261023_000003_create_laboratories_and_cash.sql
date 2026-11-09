-- ============================================================
-- Migración 003: Tablas para Laboratories (Labs), Lab Orders y Cash Movements
-- Proyecto: Clínica Admin
-- Fecha   : 2026-10-23
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABLAS DE LABORATORIO
-- ============================================================

-- Tabla base de Laboratorios (labs)
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

comment on table public.labs is 'Laboratorios dentales externos para confección de prótesis y trabajos.';
create index if not exists idx_labs_clinic on public.labs(clinic_id);

-- Vista alias laboratories -> labs (para compatibilidad total con consultas a laboratories)
create or replace view public.laboratories with (security_invoker = true) as
    select * from public.labs;

-- Tabla de Órdenes de Laboratorio (lab_orders)
create table if not exists public.lab_orders (
    id                  uuid primary key default gen_random_uuid(),
    clinic_id           uuid not null references public.clinics(id) on delete cascade,
    lab_id              uuid not null references public.labs(id) on delete restrict,
    patient_name        text not null,
    dentist_name        text not null,
    work_type           text not null,
    description         text,
    sent_date           date not null default current_date,
    due_date            date,
    received_date       date,
    installed_date      date,
    status              text not null default 'draft'
                        check (status in ('draft','sent','received','installed','cancelled')),
    lab_cost            integer not null default 0 check (lab_cost >= 0),
    charged_to_patient  integer not null default 0 check (charged_to_patient >= 0),
    billing_month       date, -- Formato YYYY-MM-01
    lab_paid            boolean not null default false,
    lab_paid_at         timestamptz,
    voided_at           timestamptz,
    void_reason         text,
    created_by          uuid references auth.users(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.lab_orders is 'Órdenes de trabajos protésicos enviadas a laboratorios.';
create index if not exists idx_lab_orders_clinic on public.lab_orders(clinic_id);
create index if not exists idx_lab_orders_lab    on public.lab_orders(lab_id);
create index if not exists idx_lab_orders_status on public.lab_orders(clinic_id, status);
create index if not exists idx_lab_orders_billing on public.lab_orders(clinic_id, billing_month, lab_paid);

-- ============================================================
-- 2. TABLAS DE CAJA DIARIA
-- ============================================================

-- Categorías de caja
create table if not exists public.cash_categories (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    name        text not null,
    type        text not null check (type in ('income', 'expense')),
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_cash_categories_clinic on public.cash_categories(clinic_id);

-- Movimientos de caja (cash_movements)
create table if not exists public.cash_movements (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    date            date not null,
    type            text not null check (type in ('income', 'expense')),
    category_id     uuid references public.cash_categories(id) on delete set null,
    amount          integer not null check (amount > 0),
    payment_method  text not null check (payment_method in ('cash', 'transfer', 'debit', 'credit', 'other')),
    description     text not null,
    lab_order_id    uuid references public.lab_orders(id) on delete set null,
    dentist_settlement_id uuid,
    created_by      uuid references auth.users(id),
    voided_at       timestamptz,
    void_reason     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_cash_movements_clinic_date on public.cash_movements(clinic_id, date);
create index if not exists idx_cash_movements_clinic_type on public.cash_movements(clinic_id, type);

-- Cierres / arqueos de caja
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

create index if not exists idx_cash_closings_clinic_date on public.cash_closings(clinic_id, date);

-- Pagos mensuales a laboratorios
create table if not exists public.lab_payments (
    id                  uuid primary key default gen_random_uuid(),
    clinic_id           uuid not null references public.clinics(id) on delete cascade,
    lab_id              uuid not null references public.labs(id) on delete restrict,
    month               date not null,
    total               integer not null check (total > 0),
    paid_at             timestamptz not null default now(),
    method              text not null check (method in ('cash', 'transfer', 'debit', 'credit', 'other')),
    notes               text,
    cash_movement_id    uuid references public.cash_movements(id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (clinic_id, lab_id, month)
);

create index if not exists idx_lab_payments_clinic on public.lab_payments(clinic_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.labs enable row level security;
alter table public.lab_orders enable row level security;
alter table public.cash_categories enable row level security;
alter table public.cash_movements enable row level security;
alter table public.cash_closings enable row level security;
alter table public.lab_payments enable row level security;

-- Políticas para labs
drop policy if exists "labs_select" on public.labs;
create policy "labs_select" on public.labs
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "labs_insert" on public.labs;
create policy "labs_insert" on public.labs
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "labs_update" on public.labs;
create policy "labs_update" on public.labs
    for update using (clinic_id = public.my_clinic_id());

drop policy if exists "labs_delete" on public.labs;
create policy "labs_delete" on public.labs
    for delete using (clinic_id = public.my_clinic_id());

-- Políticas para lab_orders
drop policy if exists "lab_orders_select" on public.lab_orders;
create policy "lab_orders_select" on public.lab_orders
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "lab_orders_insert" on public.lab_orders;
create policy "lab_orders_insert" on public.lab_orders
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "lab_orders_update" on public.lab_orders;
create policy "lab_orders_update" on public.lab_orders
    for update using (clinic_id = public.my_clinic_id());

-- Políticas para cash_categories
drop policy if exists "cash_categories_select" on public.cash_categories;
create policy "cash_categories_select" on public.cash_categories
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "cash_categories_insert" on public.cash_categories;
create policy "cash_categories_insert" on public.cash_categories
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "cash_categories_update" on public.cash_categories;
create policy "cash_categories_update" on public.cash_categories
    for update using (clinic_id = public.my_clinic_id());

-- Políticas para cash_movements
drop policy if exists "cash_movements_select" on public.cash_movements;
create policy "cash_movements_select" on public.cash_movements
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "cash_movements_insert" on public.cash_movements;
create policy "cash_movements_insert" on public.cash_movements
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "cash_movements_update" on public.cash_movements;
create policy "cash_movements_update" on public.cash_movements
    for update using (clinic_id = public.my_clinic_id());

-- Políticas para cash_closings
drop policy if exists "cash_closings_select" on public.cash_closings;
create policy "cash_closings_select" on public.cash_closings
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "cash_closings_insert" on public.cash_closings;
create policy "cash_closings_insert" on public.cash_closings
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "cash_closings_update" on public.cash_closings;
create policy "cash_closings_update" on public.cash_closings
    for update using (clinic_id = public.my_clinic_id());

-- Políticas para lab_payments
drop policy if exists "lab_payments_select" on public.lab_payments;
create policy "lab_payments_select" on public.lab_payments
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "lab_payments_insert" on public.lab_payments;
create policy "lab_payments_insert" on public.lab_payments
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "lab_payments_update" on public.lab_payments;
create policy "lab_payments_update" on public.lab_payments
    for update using (clinic_id = public.my_clinic_id());

-- ============================================================
-- 4. POBLAR CATEGORÍAS DE CAJA POR DEFECTO PARA CLÍNICAS EXISTENTES
-- ============================================================

insert into public.cash_categories (clinic_id, name, type)
select c.id, d.name, d.type
from public.clinics c
cross join (
    values
        ('Arriendo box', 'income'),
        ('Consulta / honorarios', 'income'),
        ('Venta insumos', 'income'),
        ('Otros ingresos', 'income'),
        ('Insumos / materiales', 'expense'),
        ('Laboratorio (prótesis)', 'expense'),
        ('Arriendo local', 'expense'),
        ('Servicios básicos', 'expense'),
        ('Remuneraciones / comisiones', 'expense'),
        ('Mantención equipos', 'expense'),
        ('Otros egresos', 'expense')
) as d(name, type)
where not exists (
    select 1 from public.cash_categories cc
    where cc.clinic_id = c.id and cc.name = d.name
);
