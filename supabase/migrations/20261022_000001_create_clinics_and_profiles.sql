-- ============================================================
-- Migración 001 — Clínicas y Perfiles
-- Proyecto : Clínica Admin
-- Fecha    : 2026-10-22
-- Aplicar  : SQL Editor de Supabase (pegar y ejecutar completo)
-- ============================================================

-- ------------------------------------------------------------
-- 0. Extensiones necesarias
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. Tabla: clinics
--    Una fila por clínica. Preparado para multi-clínica.
-- ------------------------------------------------------------
create table public.clinics (
    id         uuid primary key default uuid_generate_v4(),
    name       text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.clinics is
    'Clínicas registradas en el sistema. Cada dentista/admin pertenece a una.';

-- ------------------------------------------------------------
-- 2. Tabla: profiles
--    Extiende auth.users con datos de aplicación.
--    id = mismo UUID que auth.users.id
-- ------------------------------------------------------------
create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    clinic_id   uuid not null references public.clinics(id) on delete cascade,
    full_name   text not null default '',
    role        text not null default 'reception'
                    check (role in ('admin', 'reception', 'dentist')),
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'Perfil de aplicación de cada usuario. Vinculado 1-a-1 con auth.users.';

-- Índices de consulta frecuente
create index profiles_clinic_id_idx on public.profiles(clinic_id);
create index profiles_role_idx      on public.profiles(role);

-- ------------------------------------------------------------
-- 3. Función helper: obtener clinic_id del usuario autenticado
--    Se usa en las políticas RLS sin hacer JOINs inline.
-- ------------------------------------------------------------
create or replace function public.my_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select clinic_id
    from public.profiles
    where id = auth.uid()
    limit 1;
$$;

comment on function public.my_clinic_id() is
    'Devuelve el clinic_id del usuario autenticado. Usado en políticas RLS.';

-- ------------------------------------------------------------
-- 4. Función + trigger: crear perfil al registrar un usuario
--
--    Lógica:
--    - Si el metadata de auth contiene "clinic_name" -> crea una
--      clínica nueva y asigna rol "admin" (primer usuario).
--    - Si contiene "clinic_id" -> se une a una clínica existente
--      con rol "reception" (invitación futura).
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_clinic_id uuid;
    v_clinic_name text;
    v_role text;
begin
    -- Leer metadata enviado en el signUp()
    v_clinic_name := new.raw_user_meta_data->>'clinic_name';
    v_clinic_id   := (new.raw_user_meta_data->>'clinic_id')::uuid;

    if v_clinic_id is null then
        -- Primer registro: crear clínica y asignar rol admin
        v_clinic_name := coalesce(v_clinic_name, 'Mi Clínica');
        v_role := 'admin';

        insert into public.clinics (name)
        values (v_clinic_name)
        returning id into v_clinic_id;
    else
        -- Usuario invitado a clínica existente
        v_role := coalesce(new.raw_user_meta_data->>'role', 'reception');
    end if;

    insert into public.profiles (id, clinic_id, full_name, role)
    values (
        new.id,
        v_clinic_id,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        v_role
    );

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Trigger: al crear un auth.user, genera su perfil y (si es el primero) su clínica.';

-- Asociar trigger a auth.users
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 5. Row Level Security — clinics
-- ------------------------------------------------------------
alter table public.clinics enable row level security;

-- Un usuario autenticado solo ve su propia clínica
create policy "clinics_select_own"
    on public.clinics
    for select
    to authenticated
    using (id = public.my_clinic_id());

-- Solo el admin de la clínica puede editar sus datos
create policy "clinics_update_admin"
    on public.clinics
    for update
    to authenticated
    using  (id = public.my_clinic_id())
    with check (id = public.my_clinic_id());

-- Nadie puede insertar clínicas directamente (solo el trigger lo hace)
-- Nadie puede borrar clínicas desde el cliente

-- ------------------------------------------------------------
-- 6. Row Level Security — profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Cualquier usuario autenticado ve los perfiles de su clínica
create policy "profiles_select_own_clinic"
    on public.profiles
    for select
    to authenticated
    using (clinic_id = public.my_clinic_id());

-- Cada usuario puede actualizar solo su propio perfil
create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using  (id = auth.uid())
    with check (id = auth.uid());

-- Solo el admin puede insertar perfiles (invitar usuarios)
create policy "profiles_insert_admin"
    on public.profiles
    for insert
    to authenticated
    with check (
        public.my_clinic_id() is not null
        and exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'admin'
        )
    );

-- Solo el admin puede desactivar/borrar perfiles
create policy "profiles_delete_admin"
    on public.profiles
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'admin'
              and clinic_id = public.my_clinic_id()
        )
    );

-- ------------------------------------------------------------
-- 7. Trigger updated_at automático en ambas tablas
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger clinics_set_updated_at
    before update on public.clinics
    for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- ============================================================
-- FIN DE LA MIGRACIÓN 001
-- ============================================================
