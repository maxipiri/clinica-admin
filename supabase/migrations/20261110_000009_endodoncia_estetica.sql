-- ============================================================
-- Migración 009: Categorías Endodoncia y Estética + endodoncista
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-10
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
-- Nota    : los "drop constraint" solo reemplazan la regla de categorías
--           permitidas; no borran datos.
-- ============================================================

-- 1. Permitir las categorías 'endodontics' y 'aesthetics'
alter table public.appointments_work
    drop constraint if exists appointments_work_category_check;
alter table public.appointments_work
    add constraint appointments_work_category_check
    check (category in ('general', 'prosthesis', 'implant', 'orthodontics', 'endodontics', 'aesthetics'));

alter table public.treatments_catalog
    drop constraint if exists treatments_catalog_category_check;
alter table public.treatments_catalog
    add constraint treatments_catalog_category_check
    check (category in ('general', 'prosthesis', 'implant', 'orthodontics', 'endodontics', 'aesthetics'));

-- 2. Las prestaciones de endodoncia pasan a su propia categoría
update public.treatments_catalog
set category = 'endodontics'
where category = 'general'
  and name in (
    'Endodoncia molar',
    'Endodoncia pre-molar',
    'Endodoncia diente anterior',
    'Endodoncia Anterior + MTA',
    'Retratamiento endodóntico anterior',
    'Retratamiento de Endodoncia Premolar',
    'Medicación Endodoncia',
    'Trepanación Urgencia'
  );

-- 3a. Blanqueamientos y carillas pasan a Estética
update public.treatments_catalog
set category = 'aesthetics'
where category = 'general'
  and (name ilike 'blanqueamiento%' or name ilike 'carilla%');

-- 3b. Estética facial (Dr. Segovia y Dra. Milena Rutherford)
insert into public.treatments_catalog (clinic_id, name, default_price, category)
select c.id, t.name, t.price, 'aesthetics'
from public.clinics c
cross join (values
    ('Toxina botulínica 1 zona', 120000),
    ('Toxina botulínica 2 zonas', 150000),
    ('Toxina botulínica 3 zonas', 180000),
    ('Toxina botulínica full face', 260000),
    ('Toxina botulínica maseteros', 210000),
    ('Aumento de labios', 210000),
    ('Rinomodelación', 210000),
    ('Rinolips', 360000),
    ('Hilos tensores', 210000),
    ('Vitaminas', 80000),
    ('BB Glow (sesión)', 35000),
    ('Mesoterapia', 0)   -- precio por definir: editar en Prestaciones
) as t(name, price)
where not exists (
    select 1 from public.treatments_catalog tc
    where tc.clinic_id = c.id and lower(tc.name) = lower(t.name)
);

-- 4. Endodoncista Pedro Riquelme: 50% por atención
insert into public.dentists (clinic_id, full_name, pay_mode, commission_pct, commission_base)
select c.id, 'Pedro Riquelme', 'commission', 50, 'gross'
from public.clinics c
where not exists (
    select 1 from public.dentists d
    where d.clinic_id = c.id and d.full_name ilike '%riquelme%'
);

-- 5. Estética facial: Dr. Cristóbal Segovia (50% provisorio; ajustar en Dentistas)
insert into public.dentists (clinic_id, full_name, pay_mode, commission_pct, commission_base)
select c.id, 'Dr. Cristóbal Segovia', 'commission', 50, 'gross'
from public.clinics c
where not exists (
    select 1 from public.dentists d
    where d.clinic_id = c.id and d.full_name ilike '%segovia%'
);

select category, count(*) from public.treatments_catalog where active group by 1 order by 1;
