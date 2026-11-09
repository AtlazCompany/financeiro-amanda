-- create_sale aceita paid_at opcional por parcela (usado pelo importador)
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
  insert into public.installments (sale_id, number, due_date, amount_cents, paid_at)
    select v_id, (x->>'number')::smallint, (x->>'due_date')::date, (x->>'amount_cents')::bigint, nullif(x->>'paid_at', '')::date
    from jsonb_array_elements(p_installments) x;
  return v_id;
end $$;
revoke all on function public.create_sale(uuid, text, date, bigint, date, jsonb) from public, anon;
grant execute on function public.create_sale(uuid, text, date, bigint, date, jsonb) to authenticated;
