-- ============================================================
-- Migración 005: Catálogo de prótesis/implantes con costo de laboratorio
--                y pago al dentista editable por atención (fijo o %)
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-09
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- Qué agrega:
--  1. treatments_catalog: categoría, laboratorio y costo de laboratorio,
--     para que al elegir una prótesis se autocompleten el precio al
--     paciente y el costo del laboratorio.
--  2. dentists: modo de pago por defecto (comisión % o monto fijo).
--     Ej: implantólogo = $250.000 fijo por implante.
--  3. appointments_work: costo lab, insumos y pago al dentista EDITABLES
--     en cada atención (cambian según el trato).
--  4. Vista v_appointments_profit: ganancia real por atención.
--  5. Datos: lab Loreto González, arancel 2024, precios de la clínica,
--     implante desde $890.000 y Javier Toledo (implantólogo).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Catálogo: categoría + costo de laboratorio
-- ------------------------------------------------------------
alter table public.treatments_catalog
    add column if not exists category  text not null default 'general'
        check (category in ('general', 'prosthesis', 'implant')),
    add column if not exists material  text,          -- acrilica | flexible | metalica
    add column if not exists extension text,          -- unilateral | parcial | total | inmediata
    add column if not exists lab_id    uuid references public.labs(id) on delete set null,
    add column if not exists lab_cost  integer not null default 0 check (lab_cost >= 0);

create index if not exists idx_treatments_category
    on public.treatments_catalog(clinic_id, category);

-- ------------------------------------------------------------
-- 2. Dentistas: modo de pago por defecto
-- ------------------------------------------------------------
alter table public.dentists
    add column if not exists pay_mode text not null default 'commission'
        check (pay_mode in ('commission', 'fixed')),
    add column if not exists fixed_fee integer check (fixed_fee >= 0);

comment on column public.dentists.pay_mode  is 'commission = % sobre la atención; fixed = monto fijo por atención (ej. implantólogo).';
comment on column public.dentists.fixed_fee is 'Monto fijo por atención cuando pay_mode = fixed.';

-- ------------------------------------------------------------
-- 3. Atenciones: costos y pago al dentista editables por atención
-- ------------------------------------------------------------
alter table public.appointments_work
    add column if not exists category        text not null default 'general'
        check (category in ('general', 'prosthesis', 'implant')),
    add column if not exists lab_cost        integer not null default 0 check (lab_cost >= 0),
    add column if not exists supplies_cost   integer not null default 0 check (supplies_cost >= 0),
    add column if not exists dentist_pay_mode text
        check (dentist_pay_mode in ('commission', 'fixed')),
    add column if not exists dentist_pct     numeric(5,2)
        check (dentist_pct >= 0 and dentist_pct <= 100),
    add column if not exists dentist_fixed   integer check (dentist_fixed >= 0),
    add column if not exists lab_order_id    uuid references public.lab_orders(id) on delete set null;

comment on column public.appointments_work.dentist_pay_mode is
    'Si es null se usa el modo del dentista. Permite cambiar el trato en cada atención.';

-- ------------------------------------------------------------
-- 4. Vista de rentabilidad por atención
-- ------------------------------------------------------------
create or replace view public.v_appointments_profit
with (security_invoker = true) as
select
    a.*,
    p.full_name as patient_name,
    d.full_name as dentist_name,
    a.amount - a.paid_amount                         as balance_due,
    calc.pay_mode                                    as effective_pay_mode,
    calc.dentist_pay,
    a.amount - a.lab_cost - a.supplies_cost - calc.dentist_pay      as clinic_profit,
    a.paid_amount - a.lab_cost - a.supplies_cost - calc.dentist_pay as cash_position
from public.appointments_work a
join public.patients p on p.id = a.patient_id
join public.dentists d on d.id = a.dentist_id
cross join lateral (
    select
        coalesce(a.dentist_pay_mode, d.pay_mode) as pay_mode,
        case
            when coalesce(a.dentist_pay_mode, d.pay_mode) = 'fixed'
                then coalesce(a.dentist_fixed, d.fixed_fee, 0)
            else round(
                    (case when d.commission_base = 'net'
                          then a.amount - a.lab_cost - a.supplies_cost
                          else a.amount end)
                    * coalesce(a.dentist_pct, d.commission_pct) / 100
                 )::integer
        end as dentist_pay
) calc
where a.voided_at is null;

comment on view public.v_appointments_profit is
    'Atención + pago al dentista + ganancia de la clínica (valor - lab - insumos - dentista).';

-- ------------------------------------------------------------
-- 5. Datos iniciales (para cada clínica existente)
-- ------------------------------------------------------------

-- 5a. Laboratorio Loreto González
insert into public.labs (clinic_id, name, contact, phone, email)
select c.id, 'ML CAD LAB · Loreto González', 'María Loretto González Espinoza',
       '+56996399476', 'mlgonzalez.e@gmail.com'
from public.clinics c
where not exists (
    select 1 from public.labs l
    where l.clinic_id = c.id and l.name ilike '%loret%'
);

-- 5b. Prótesis: precio paciente (default_price) + costo lab (arancel 2024)
--     Flexible = Valplast. Flexible total: costo lab por confirmar (0).
insert into public.treatments_catalog
       (clinic_id, name, category, material, extension, default_price, lab_cost, lab_id)
select c.id, t.name, 'prosthesis', t.material, t.extension, t.price, t.lab_cost,
       (select l.id from public.labs l
         where l.clinic_id = c.id and l.name ilike '%loret%' limit 1)
from public.clinics c
cross join (values
    ('Prótesis parcial acrílica unilateral',            'acrilica', 'unilateral', 120000,  50000),
    ('Prótesis parcial acrílica superior o inferior',   'acrilica', 'parcial',    189990,  65000),
    ('Prótesis total acrílica superior o inferior',     'acrilica', 'total',      189990,  65000),
    ('Prótesis inmediata',                              'acrilica', 'inmediata',   90000,  65000),
    ('Prótesis flexible unilateral (2 dientes)',        'flexible', 'unilateral', 184000,  80000),
    ('Prótesis flexible parcial superior o inferior',   'flexible', 'parcial',    270000, 100000),
    ('Prótesis flexible total superior o inferior',     'flexible', 'total',      320000,      0),
    ('Prótesis metálica superior o inferior',           'metalica', 'parcial',    340000, 100000)
) as t(name, material, extension, price, lab_cost)
where not exists (
    select 1 from public.treatments_catalog tc
    where tc.clinic_id = c.id and tc.name = t.name
);

-- 5c. Implante (desde $890.000; corona e insumos se ingresan en cada atención)
insert into public.treatments_catalog (clinic_id, name, category, default_price, lab_cost)
select c.id, 'Implante', 'implant', 890000, 0
from public.clinics c
where not exists (
    select 1 from public.treatments_catalog tc
    where tc.clinic_id = c.id and tc.name = 'Implante'
);

-- 5d. Implantólogo Javier Toledo: $250.000 fijo por implante
insert into public.dentists (clinic_id, full_name, pay_mode, fixed_fee, commission_pct)
select c.id, 'Javier Toledo', 'fixed', 250000, 0
from public.clinics c
where not exists (
    select 1 from public.dentists d
    where d.clinic_id = c.id and d.full_name ilike 'javier toledo%'
);
