-- REVERTE a migracao 20261110000004_profit_fields.sql.
-- Atencao: remove as colunas de custo/preco/quantidade/desconto (esses valores se perdem).
-- O total das vendas (total_cents), as parcelas, os pagamentos e todo o restante permanecem intactos.
drop function if exists public.create_sale_with_profit(uuid, text, date, integer, bigint, bigint, bigint, date, jsonb);
alter table public.sales drop constraint if exists sales_total_matches_price;
alter table public.sales
  drop column if exists quantity,
  drop column if exists unit_cost_cents,
  drop column if exists unit_price_cents,
  drop column if exists discount_cents;
