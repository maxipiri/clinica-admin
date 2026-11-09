-- ============================================================
-- Migración 008: Gastos fijos mensuales (arriendo, servicios, etc.)
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-09
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- Cada gasto fijo se "carga" una vez por mes como egreso en la caja
-- (cash_movements), con un botón desde el Dashboard.
-- ============================================================

create table if not exists public.recurring_expenses (
    id              uuid primary key default gen_random_uuid(),
    clinic_id       uuid not null references public.clinics(id) on delete cascade,
    name            text not null,
    amount          integer not null check (amount > 0),
    category_id     uuid references public.cash_categories(id) on delete set null,
    payment_method  text not null default 'transfer'
                    check (payment_method in ('cash', 'transfer', 'debit', 'credit', 'other')),
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table public.recurring_expenses is 'Gastos fijos que se repiten cada mes.';
create index if not exists idx_recurring_expenses_clinic on public.recurring_expenses(clinic_id);

-- Trigger y políticas solo si no existen (se puede re-ejecutar sin problema)
do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'recurring_expenses_updated_at') then
        create trigger recurring_expenses_updated_at
            before update on public.recurring_expenses
            for each row execute function public.set_updated_at();
    end if;
end $$;

alter table public.recurring_expenses enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where tablename = 'recurring_expenses' and policyname = 'recurring_select') then
        create policy "recurring_select" on public.recurring_expenses
            for select using (clinic_id = public.my_clinic_id());
    end if;
    if not exists (select 1 from pg_policies where tablename = 'recurring_expenses' and policyname = 'recurring_insert') then
        create policy "recurring_insert" on public.recurring_expenses
            for insert with check (clinic_id = public.my_clinic_id());
    end if;
    if not exists (select 1 from pg_policies where tablename = 'recurring_expenses' and policyname = 'recurring_update') then
        create policy "recurring_update" on public.recurring_expenses
            for update using (clinic_id = public.my_clinic_id());
    end if;
end $$;

-- Vínculo del egreso de caja con el gasto fijo que lo originó
alter table public.cash_movements
    add column if not exists recurring_expense_id uuid
        references public.recurring_expenses(id) on delete set null;

create index if not exists idx_cash_movements_recurring
    on public.cash_movements(recurring_expense_id, date);

-- Gasto fijo inicial: arriendo $300.000 (de la planilla GASTOS)
insert into public.recurring_expenses (clinic_id, name, amount, category_id)
select c.id, 'Arriendo', 300000,
       (select cc.id from public.cash_categories cc
         where cc.clinic_id = c.id and cc.type = 'expense' and cc.name ilike 'arriendo%' limit 1)
from public.clinics c
where not exists (
    select 1 from public.recurring_expenses r
    where r.clinic_id = c.id and r.name ilike 'arriendo%'
);
