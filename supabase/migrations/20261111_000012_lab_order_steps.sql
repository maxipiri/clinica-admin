-- ============================================================
-- Migración 012: Movimientos de las órdenes de laboratorio por etapa
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-11
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- Una prótesis va y vuelve varias veces entre la clínica y el laboratorio
-- (modelo → rodete → enfilado → terminación). Cada ida y vuelta queda en el
-- historial con su etapa y la FECHA REAL en que ocurrió (puede ser anterior
-- al día en que se anota).
-- ============================================================

-- 1. Etapa, dirección y fecha real en el historial
alter table public.lab_order_events
    add column if not exists stage      text,
    add column if not exists direction  text check (direction in ('sent', 'received', 'installed', 'other')),
    add column if not exists event_date date;

-- 2. El trigger de estados no duplica cuando el cambio viene de "registrar movimiento"
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
    if coalesce(current_setting('clinica.skip_status_log', true), '') = 'on' then
        return new;
    end if;

    select nullif(full_name, '') into v_name from public.profiles where id = auth.uid();

    insert into public.lab_order_events (clinic_id, lab_order_id, from_status, to_status, changed_by, changed_by_name, event_date)
    values (
        new.clinic_id,
        new.id,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status,
        auth.uid(),
        v_name,
        (now() at time zone 'America/Santiago')::date
    );
    return new;
end;
$$;

-- 3. Registrar un movimiento (envío / recepción / instalación) en un solo paso
create or replace function public.register_lab_step(
    p_order_id   uuid,
    p_stage      text,
    p_direction  text,
    p_event_date date,
    p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order  public.lab_orders%rowtype;
    v_name   text;
    v_status text;
begin
    select * into v_order from public.lab_orders where id = p_order_id;
    if not found or v_order.clinic_id is distinct from public.my_clinic_id() then
        raise exception 'Orden no encontrada';
    end if;
    if p_direction not in ('sent', 'received', 'installed', 'other') then
        raise exception 'Movimiento inválido';
    end if;

    v_status := case p_direction
        when 'sent' then 'sent'
        when 'received' then 'received'
        when 'installed' then 'installed'
        else v_order.status
    end;

    select nullif(full_name, '') into v_name from public.profiles where id = auth.uid();

    insert into public.lab_order_events
        (clinic_id, lab_order_id, from_status, to_status, stage, direction, event_date, note, changed_by, changed_by_name)
    values
        (v_order.clinic_id, v_order.id, v_order.status, v_status, p_stage, p_direction,
         coalesce(p_event_date, (now() at time zone 'America/Santiago')::date),
         nullif(trim(p_note), ''), auth.uid(), v_name);

    perform set_config('clinica.skip_status_log', 'on', true);
    update public.lab_orders
    set status         = v_status,
        received_date  = case when p_direction = 'received' then coalesce(p_event_date, received_date) else received_date end,
        installed_date = case when p_direction = 'installed' then coalesce(p_event_date, installed_date) else installed_date end
    where id = v_order.id;
    perform set_config('clinica.skip_status_log', 'off', true);
end;
$$;

revoke all on function public.register_lab_step(uuid, text, text, date, text) from public;
grant execute on function public.register_lab_step(uuid, text, text, date, text) to authenticated;
