-- ============================================================
-- Migración 010: Historial de estados de las órdenes de laboratorio
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-10
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- Cada vez que una orden se crea o cambia de estado (borrador, enviada,
-- recibida, instalada, cancelada) queda un registro con fecha, hora,
-- estado anterior, estado nuevo y quién lo hizo. Lo hace la base de datos
-- sola (trigger), así no depende de la pantalla desde donde se cambie.
-- ============================================================

create table if not exists public.lab_order_events (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    lab_order_id    uuid not null references public.lab_orders(id) on delete cascade,
    from_status     text,
    to_status       text not null,
    changed_by      uuid references auth.users(id) on delete set null,
    changed_by_name text,
    note            text,
    created_at      timestamptz not null default now()
);

comment on table public.lab_order_events is 'Historial de cambios de estado de cada orden de laboratorio.';
create index if not exists idx_lab_order_events_order on public.lab_order_events(lab_order_id, created_at);

alter table public.lab_order_events enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where tablename = 'lab_order_events' and policyname = 'lab_order_events_select') then
        create policy "lab_order_events_select" on public.lab_order_events
            for select using (clinic_id = public.my_clinic_id());
    end if;
end $$;

-- Función que registra el cambio (security definer: escribe aunque la tabla no tenga política de insert)
create or replace function public.log_lab_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text;
begin
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
        return new;
    end if;

    select nullif(full_name, '') into v_name from public.profiles where id = auth.uid();

    insert into public.lab_order_events (clinic_id, lab_order_id, from_status, to_status, changed_by, changed_by_name)
    values (
        new.clinic_id,
        new.id,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status,
        auth.uid(),
        v_name
    );
    return new;
end;
$$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'lab_orders_log_status') then
        create trigger lab_orders_log_status
            after insert or update of status on public.lab_orders
            for each row execute function public.log_lab_order_status();
    end if;
end $$;

-- Órdenes que ya existían: se registra su estado actual con la fecha de su último cambio
insert into public.lab_order_events (clinic_id, lab_order_id, from_status, to_status, note, created_at)
select o.clinic_id, o.id, null, o.status, 'Estado al activar el historial', o.updated_at
from public.lab_orders o
where not exists (select 1 from public.lab_order_events e where e.lab_order_id = o.id);
