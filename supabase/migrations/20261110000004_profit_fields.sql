-- Controle de lucro: migracao INCREMENTAL e segura (nao recria tabelas, nao apaga nem altera dados existentes).
-- Vendas antigas ficam com quantity = 1, unit_cost_cents = NULL ("custo nao informado") e unit_price_cents = NULL.
-- Reversao: supabase/rollbacks/20261110000004_profit_fields.down.sql

alter table public.sales
  add column quantity integer not null default 1 check (quantity > 0),
  add column unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  add column unit_price_cents bigint check (unit_price_cents is null or unit_price_cents > 0),
  add column discount_cents bigint not null default 0 check (discount_cents >= 0);

-- Quando ha preco unitario, o total (que e parcelado) = quantidade x preco - desconto.
alter table public.sales add constraint sales_total_matches_price
  check (unit_price_cents is null or total_cents = quantity::bigint * unit_price_cents - discount_cents);

-- Nova funcao (a create_sale antiga continua existindo e funcionando para o app em producao).
create or replace function public.create_sale_with_profit(
  p_client_id uuid, p_description text, p_sale_date date,
  p_quantity integer, p_unit_cost_cents bigint, p_unit_price_cents bigint, p_discount_cents bigint,
  p_first_due_date date, p_installments jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_count int; v_sum bigint; v_total bigint;
begin
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantidade invalida'; end if;
  if p_unit_price_cents is null or p_unit_price_cents < 1 then raise exception 'Preco de venda invalido'; end if;
  if coalesce(p_discount_cents, 0) < 0 then raise exception 'Desconto invalido'; end if;
  v_total := p_quantity::bigint * p_unit_price_cents - coalesce(p_discount_cents, 0);
  if v_total <= 0 then raise exception 'O desconto nao pode ser maior que o valor da venda'; end if;
  v_count := jsonb_array_length(p_installments);
  if v_count < 1 or v_count > 6 then raise exception 'Parcelas devem ser de 1 a 6'; end if;
  select coalesce(sum((x->>'amount_cents')::bigint), 0) into v_sum from jsonb_array_elements(p_installments) x;
  if v_sum <> v_total then raise exception 'A soma das parcelas difere do total da venda'; end if;
  insert into public.sales (client_id, description, sale_date, total_cents, installments_count, first_due_date,
                            quantity, unit_cost_cents, unit_price_cents, discount_cents)
    values (p_client_id, p_description, p_sale_date, v_total, v_count, p_first_due_date,
            p_quantity, p_unit_cost_cents, p_unit_price_cents, coalesce(p_discount_cents, 0))
    returning id into v_id;
  insert into public.installments (sale_id, number, due_date, amount_cents)
    select v_id, (x->>'number')::smallint, (x->>'due_date')::date, (x->>'amount_cents')::bigint
    from jsonb_array_elements(p_installments) x;
  return v_id;
end $$;
revoke all on function public.create_sale_with_profit(uuid, text, date, integer, bigint, bigint, bigint, date, jsonb) from public, anon;
grant execute on function public.create_sale_with_profit(uuid, text, date, integer, bigint, bigint, bigint, date, jsonb) to authenticated;
