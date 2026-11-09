-- Financeiro Amanda: schema, RLS e travas de seguranca

-- Lista de e-mails autorizados (sem acesso pela API: RLS ligada e nenhuma policy)
create table public.allowed_emails (email text primary key);
alter table public.allowed_emails enable row level security;

create or replace function public.block_unlisted_signups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    raise exception 'Cadastro nao permitido';
  end if;
  return new;
end $$;
revoke all on function public.block_unlisted_signups() from public, anon, authenticated;
create trigger block_unlisted_signups before insert on auth.users
  for each row execute function public.block_unlisted_signups();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default 'Amanda',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  whatsapp text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  description text not null check (length(btrim(description)) > 0),
  sale_date date not null,
  total_cents bigint not null check (total_cents > 0),
  installments_count smallint not null check (installments_count between 1 and 6),
  first_due_date date not null,
  created_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  number smallint not null check (number between 1 and 6),
  due_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at date,
  created_at timestamptz not null default now(),
  unique (sale_id, number)
);

create table public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  order_number text not null check (length(btrim(order_number)) > 0),
  order_date date,
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  paid_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.financial_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete restrict,
  opening_balance_cents bigint not null default 0,
  opening_balance_date date not null default current_date,
  alert_days smallint not null default 7 check (alert_days between 0 and 60)
);

create index clients_user_idx on public.clients(user_id);
create index sales_user_date_idx on public.sales(user_id, sale_date);
create index sales_client_idx on public.sales(client_id);
create index installments_user_due_idx on public.installments(user_id, due_date);
create index installments_sale_idx on public.installments(sale_id);
create index bills_user_due_idx on public.supplier_bills(user_id, due_date);

-- RLS: cada usuaria so enxerga e altera os proprios registros
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['clients','sales','installments','supplier_bills','financial_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t||'_delete', t);
  end loop;
end $$;

-- Sem acesso anonimo
revoke all on all tables in schema public from anon;

-- Travas contra exclusao acidental de dados financeiros
create or replace function public.prevent_paid_installment_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.paid_at is not null then
    raise exception 'Parcela paga nao pode ser excluida. Desfaca o pagamento primeiro.';
  end if;
  return old;
end $$;
create trigger installments_no_paid_delete before delete on public.installments
  for each row execute function public.prevent_paid_installment_delete();

-- Criacao atomica de venda + parcelas (valores calculados no app e validados aqui)
create or replace function public.create_sale(
  p_client_id uuid, p_description text, p_sale_date date, p_total_cents bigint,
  p_first_due_date date, p_installments jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_count int; v_sum bigint;
begin
  v_count := jsonb_array_length(p_installments);
  if v_count < 1 or v_count > 6 then raise exception 'Parcelas devem ser de 1 a 6'; end if;
  select coalesce(sum((x->>'amount_cents')::bigint), 0) into v_sum from jsonb_array_elements(p_installments) x;
  if v_sum <> p_total_cents then raise exception 'A soma das parcelas difere do total'; end if;
  insert into public.sales (client_id, description, sale_date, total_cents, installments_count, first_due_date)
    values (p_client_id, p_description, p_sale_date, p_total_cents, v_count, p_first_due_date)
    returning id into v_id;
  insert into public.installments (sale_id, number, due_date, amount_cents)
    select v_id, (x->>'number')::smallint, (x->>'due_date')::date, (x->>'amount_cents')::bigint
    from jsonb_array_elements(p_installments) x;
  return v_id;
end $$;
revoke all on function public.create_sale(uuid, text, date, bigint, date, jsonb) from public, anon;
grant execute on function public.create_sale(uuid, text, date, bigint, date, jsonb) to authenticated;
