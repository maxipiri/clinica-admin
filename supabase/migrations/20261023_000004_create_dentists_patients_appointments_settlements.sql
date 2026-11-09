-- ============================================================
-- Migración 004: Dentistas, Pacientes, Tratamientos, Atenciones y Liquidaciones
-- Proyecto: Clínica Admin
-- Fecha   : 2026-10-23
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABLA DENTISTAS (dentists)
-- ============================================================
create table if not exists public.dentists (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    profile_id      uuid references public.profiles(id) on delete set null,
    full_name       text not null,
    rut             text,
    phone           text,
    email           text,
    commission_pct  numeric(5,2) not null default 50.00 check (commission_pct >= 0 and commission_pct <= 100),
    commission_base text not null default 'gross' check (commission_base in ('gross', 'net')),
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table public.dentists is 'Dentistas y profesionales tratantes de la clínica.';
create index if not exists idx_dentists_clinic on public.dentists(clinic_id);

-- ============================================================
-- 2. TABLA PACIENTES (patients)
-- ============================================================
create table if not exists public.patients (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    full_name   text not null,
    rut         text,
    phone       text,
    email       text,
    notes       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.patients is 'Fichas básicas de pacientes de la clínica.';
create index if not exists idx_patients_clinic on public.patients(clinic_id);
create index if not exists idx_patients_name on public.patients(clinic_id, full_name);

-- ============================================================
-- 3. TABLA CATÁLOGO DE TRATAMIENTOS (treatments_catalog)
-- ============================================================
create table if not exists public.treatments_catalog (
    id            uuid primary key default gen_random_uuid(),
    clinic_id     uuid not null references public.clinics(id) on delete cascade,
    name          text not null,
    default_price integer not null default 0 check (default_price >= 0),
    active        boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.treatments_catalog is 'Catálogo de procedimientos y aranceles de referencia.';
create index if not exists idx_treatments_clinic on public.treatments_catalog(clinic_id);

-- ============================================================
-- 4. TABLA ATENCIONES REALIZADAS (appointments_work)
-- ============================================================
create table if not exists public.appointments_work (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    date            date not null default current_date,
    patient_id      uuid not null references public.patients(id) on delete restrict,
    dentist_id      uuid not null references public.dentists(id) on delete restrict,
    treatment_id    uuid references public.treatments_catalog(id) on delete set null,
    description     text not null,
    amount          integer not null check (amount >= 0),
    paid_amount     integer not null default 0 check (paid_amount >= 0),
    payment_status  text not null default 'pending' check (payment_status in ('pending', 'partial', 'paid')),
    voided_at       timestamptz,
    void_reason     text,
    created_by      uuid references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table public.appointments_work is 'Tratamientos y atenciones efectuadas a pacientes.';
create index if not exists idx_appointments_clinic_date on public.appointments_work(clinic_id, date);
create index if not exists idx_appointments_dentist on public.appointments_work(clinic_id, dentist_id);
create index if not exists idx_appointments_patient on public.appointments_work(clinic_id, patient_id);

-- Conectar appointments_work con cash_movements si se requiere
alter table public.cash_movements
    add column if not exists appointment_id uuid references public.appointments_work(id) on delete set null;

-- ============================================================
-- 5. TABLAS DE LIQUIDACIONES DE DENTISTAS
-- ============================================================
create table if not exists public.dentist_settlements (
    id               uuid primary key default gen_random_uuid(),
    clinic_id        uuid not null references public.clinics(id) on delete cascade,
    dentist_id       uuid not null references public.dentists(id) on delete restrict,
    month            date not null, -- Primer día del mes (ej: 2026-10-01)
    gross_total      integer not null default 0 check (gross_total >= 0),
    lab_discounts    integer not null default 0 check (lab_discounts >= 0),
    commission_pct   numeric(5,2) not null check (commission_pct >= 0 and commission_pct <= 100),
    amount_due       integer not null default 0 check (amount_due >= 0),
    status           text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
    paid_at          timestamptz,
    cash_movement_id uuid references public.cash_movements(id) on delete set null,
    created_by       uuid references auth.users(id),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (clinic_id, dentist_id, month)
);

comment on table public.dentist_settlements is 'Liquidaciones mensuales por dentista.';
create index if not exists idx_settlements_clinic_month on public.dentist_settlements(clinic_id, month);

create table if not exists public.dentist_settlement_items (
    id                uuid primary key default gen_random_uuid(),
    clinic_id         uuid not null references public.clinics(id) on delete cascade,
    settlement_id     uuid not null references public.dentist_settlements(id) on delete cascade,
    appointment_id    uuid not null references public.appointments_work(id) on delete restrict,
    base_amount       integer not null check (base_amount >= 0),
    commission_amount integer not null check (commission_amount >= 0),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

comment on table public.dentist_settlement_items is 'Detalle de tratamientos incluidos en cada liquidación.';
create index if not exists idx_settlement_items on public.dentist_settlement_items(settlement_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.dentists enable row level security;
alter table public.patients enable row level security;
alter table public.treatments_catalog enable row level security;
alter table public.appointments_work enable row level security;
alter table public.dentist_settlements enable row level security;
alter table public.dentist_settlement_items enable row level security;

-- Políticas dentists
drop policy if exists "dentists_select" on public.dentists;
create policy "dentists_select" on public.dentists
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "dentists_insert" on public.dentists;
create policy "dentists_insert" on public.dentists
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "dentists_update" on public.dentists;
create policy "dentists_update" on public.dentists
    for update using (clinic_id = public.my_clinic_id());

drop policy if exists "dentists_delete" on public.dentists;
create policy "dentists_delete" on public.dentists
    for delete using (clinic_id = public.my_clinic_id());

-- Políticas patients
drop policy if exists "patients_select" on public.patients;
create policy "patients_select" on public.patients
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "patients_insert" on public.patients;
create policy "patients_insert" on public.patients
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "patients_update" on public.patients;
create policy "patients_update" on public.patients
    for update using (clinic_id = public.my_clinic_id());

drop policy if exists "patients_delete" on public.patients;
create policy "patients_delete" on public.patients
    for delete using (clinic_id = public.my_clinic_id());

-- Políticas treatments_catalog
drop policy if exists "treatments_select" on public.treatments_catalog;
create policy "treatments_select" on public.treatments_catalog
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "treatments_insert" on public.treatments_catalog;
create policy "treatments_insert" on public.treatments_catalog
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "treatments_update" on public.treatments_catalog;
create policy "treatments_update" on public.treatments_catalog
    for update using (clinic_id = public.my_clinic_id());

drop policy if exists "treatments_delete" on public.treatments_catalog;
create policy "treatments_delete" on public.treatments_catalog
    for delete using (clinic_id = public.my_clinic_id());

-- Políticas appointments_work
drop policy if exists "appointments_select" on public.appointments_work;
create policy "appointments_select" on public.appointments_work
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "appointments_insert" on public.appointments_work;
create policy "appointments_insert" on public.appointments_work
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "appointments_update" on public.appointments_work;
create policy "appointments_update" on public.appointments_work
    for update using (clinic_id = public.my_clinic_id());

-- Políticas dentist_settlements
drop policy if exists "settlements_select" on public.dentist_settlements;
create policy "settlements_select" on public.dentist_settlements
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "settlements_insert" on public.dentist_settlements;
create policy "settlements_insert" on public.dentist_settlements
    for insert with check (clinic_id = public.my_clinic_id());

drop policy if exists "settlements_update" on public.dentist_settlements;
create policy "settlements_update" on public.dentist_settlements
    for update using (clinic_id = public.my_clinic_id());

-- Políticas dentist_settlement_items
drop policy if exists "settlement_items_select" on public.dentist_settlement_items;
create policy "settlement_items_select" on public.dentist_settlement_items
    for select using (clinic_id = public.my_clinic_id());

drop policy if exists "settlement_items_insert" on public.dentist_settlement_items;
create policy "settlement_items_insert" on public.dentist_settlement_items
    for insert with check (clinic_id = public.my_clinic_id());

-- ============================================================
-- 7. SEMBRAR TRATAMIENTOS POR DEFECTO PARA CLÍNICAS EXISTENTES
-- ============================================================
insert into public.treatments_catalog (clinic_id, name, default_price)
select c.id, t.name, t.default_price
from public.clinics c
cross join (
    values
        ('Evaluación inicial / Diagnóstico', 15000),
        ('Destartraje + Profilaxis', 35000),
        ('Restauración composite simple (1 superficie)', 35000),
        ('Restauración composite compleja (2+ superficies)', 45000),
        ('Extracción simple', 30000),
        ('Extracción tercer molar (quirúrgica)', 80000),
        ('Endodoncia unirradicular', 90000),
        ('Endodoncia multirradicular', 150000),
        ('Blanqueamiento dental LED', 120000),
        ('Corona de porcelana sobre metal', 180000),
        ('Corona Zirconio monolítico', 240000),
        ('Plano de relajación / Brujismo', 95000)
) as t(name, default_price)
where not exists (
    select 1 from public.treatments_catalog tc
    where tc.clinic_id = c.id and tc.name = t.name
);
