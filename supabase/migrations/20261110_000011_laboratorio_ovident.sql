-- ============================================================
-- Migración 011: Laboratorio Ovident para coronas de implantes
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-10
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- Las coronas de implantes las hace Ovident (no Loreto González).
-- Así cada laboratorio tiene su propia cuenta por pagar.
-- ============================================================

-- 1. Crear el laboratorio Ovident
insert into public.labs (clinic_id, name, contact, phone, email)
select c.id, 'Ovident',
       'Mirasol Pje Tierra de Fuego 2067, Pto Montt',
       '+56978608858 / +56939071168 / (65) 2275517',
       'laboratoriodentalovident2024@gmail.com'
from public.clinics c
where not exists (
    select 1 from public.labs l where l.clinic_id = c.id and l.name ilike '%ovident%'
);

-- 2. El "Implante" del catálogo queda asociado a Ovident (las órdenes nuevas van ahí)
update public.treatments_catalog tc
set lab_id = (select l.id from public.labs l where l.clinic_id = tc.clinic_id and l.name ilike '%ovident%' limit 1)
where tc.category = 'implant';

-- 3. Órdenes de coronas de implantes ya creadas (no pagadas) pasan a Ovident
update public.lab_orders o
set lab_id = (select l.id from public.labs l where l.clinic_id = o.clinic_id and l.name ilike '%ovident%' limit 1)
where o.lab_paid = false
  and o.voided_at is null
  and o.id in (
      select a.lab_order_id from public.appointments_work a
      where a.category = 'implant' and a.lab_order_id is not null
  );

select l.name as laboratorio, count(o.id) as ordenes, coalesce(sum(o.lab_cost), 0) as total
from public.labs l
left join public.lab_orders o on o.lab_id = l.id and o.voided_at is null and o.lab_paid = false
group by l.name order by l.name;
