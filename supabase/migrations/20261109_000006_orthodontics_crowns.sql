-- ============================================================
-- Migración 006: Categoría Ortodoncia + cantidad de coronas en implantes
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-09
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
-- Nota    : los "drop constraint" solo reemplazan la regla de categorías
--           permitidas; no borran datos.
-- ============================================================

-- 1. Permitir la categoría 'orthodontics' (Ortodoncia)
alter table public.appointments_work
    drop constraint if exists appointments_work_category_check;
alter table public.appointments_work
    add constraint appointments_work_category_check
    check (category in ('general', 'prosthesis', 'implant', 'orthodontics'));

alter table public.treatments_catalog
    drop constraint if exists treatments_catalog_category_check;
alter table public.treatments_catalog
    add constraint treatments_catalog_category_check
    check (category in ('general', 'prosthesis', 'implant', 'orthodontics'));

-- 2. Cantidad de coronas por implante (cada corona: costo de laboratorio)
alter table public.appointments_work
    add column if not exists crown_qty integer check (crown_qty >= 0);

comment on column public.appointments_work.crown_qty is
    'Implantes: número de coronas. lab_cost = crown_qty × valor corona.';
