# Migração do controle de lucro (004) — como aplicar e reverter

**Status: NÃO aplicada na produção.** Foi validada apenas em um Postgres isolado (`npm run test:migration`).

## O que ela faz (incremental, sem apagar nada)

Arquivo: `supabase/migrations/20261110000004_profit_fields.sql`

- Acrescenta 4 colunas em `public.sales`: `quantity` (padrão 1), `unit_cost_cents` (NULL = *custo não informado*), `unit_price_cents` (NULL em vendas antigas) e `discount_cents` (padrão 0), com `CHECK`s.
- `CHECK` extra: quando há preço unitário, `total_cents = quantity × unit_price_cents − discount_cents`.
- Cria a função `create_sale_with_profit(...)` (valida a soma das parcelas contra o total calculado).
- **Não** altera tabelas existentes além do `ADD COLUMN`, não recria nada, não mexe em `create_sale` (o app atual em produção continua funcionando).
- Vendas antigas ficam com `quantity = 1`, `unit_cost_cents = NULL`, `unit_price_cents = NULL`, `discount_cents = 0`: aparecem como **“Custo não informado”** e ficam fora do lucro, sem inventar custo zero.

## Ordem segura de publicação

1. Aplicar a migração 004 no Supabase (o app atual continua igual, pois ignora as colunas novas).
2. Só então fazer o merge de `feature/lucro-redesign` na `master` (o Render publica sozinho).

> Se a `master` for publicada **antes** da migração, o app novo não carrega as vendas (as colunas ainda não existem).

## Reversão

`supabase/rollbacks/20261110000004_profit_fields.down.sql` remove a função e as 4 colunas (os valores de custo/preço/desconto/quantidade se perdem; totais, parcelas e pagamentos permanecem). Se o app novo já estiver no ar, volte também o deploy anterior no Render.

## Verificação rápida depois de aplicar

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'sales'
   and column_name in ('quantity','unit_cost_cents','unit_price_cents','discount_cents');  -- 4 linhas
select count(*) from public.sales where unit_cost_cents is null;  -- vendas antigas
```
