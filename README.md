# Financeiro Amanda

Sistema web (PWA) para a revendedora Amanda controlar **clientes, vendas parceladas, boletos do Boticário e caixa** — pensado para o **iPhone (Safari)**.

React + Vite + TypeScript · Tailwind CSS · Lucide · Supabase (PostgreSQL + Auth + RLS) · Render Static Site. Sem backend próprio.

## Como a Amanda usa (iPhone)

1. Abra o endereço do site no **Safari**.
2. **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone *Financeiro Amanda*. Na primeira vez, entre com e-mail e senha (a sessão fica salva).
4. Registrar uma venda: toque no botão **+** verde (centro da barra) → cliente, produto, valor, parcelas → **Salvar venda**.
5. Cliente pagou: **Registrar pagamento** (tela inicial) → **Marcar como pago** → confirmar a data.
6. Boletos: aba **Boletos** → **Novo** → ao pagar, **Marcar boleto como pago**.
7. Em **Ajustes** (engrenagem, tela inicial): informe o **saldo inicial** do caixa e a data.

## Regras financeiras (espelham a planilha)

Tudo em **centavos inteiros**; datas ISO. Código em `src/lib/finance.ts` (testado em `finance.test.ts`, que reproduz os números da planilha de demonstração).

- Parcelas = `ROUND(total/n)`; a **última parcela absorve os centavos** (R$ 100 em 6x → 16,67 ×5 + 16,65). Vencimentos mensais no estilo `EDATE`.
- Parcela só é **recebida** quando tem data de pagamento. O caixa é derivado dessas datas (não há lançamento duplicado).
- **Saldo disponível** = saldo inicial (uma única vez, a partir da data configurada) + parcelas pagas − boletos pagos.
- **Parcelas atrasadas nunca são dinheiro** (nem na projeção).
- **Alerta de caixa**: para cada boleto em aberto, em ordem cronológica: caixa de hoje + parcelas ainda a vencer até o vencimento dele − todos os boletos em aberto até aquele dia. Negativo ⇒ alerta. O mesmo saldo nunca é usado duas vezes.
- Pagamentos são sempre da parcela inteira (sem pagamento parcial no MVP).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chave pública)
npm run dev                  # http://localhost:5173
npm test                     # regras financeiras
npm run build                # produção (dist/)
```

## Banco (Supabase)

Migrações versionadas em `supabase/migrations/` (já aplicadas no projeto `financeiro-amanda`):

- Tabelas: `profiles`, `clients`, `sales`, `installments`, `supplier_bills`, `financial_settings` (+ `allowed_emails`).
- **RLS em todas**: leitura/criação/edição/exclusão só do próprio `user_id`; `anon` sem acesso.
- FKs `ON DELETE RESTRICT` (sem exclusão em cascata); parcela paga não pode ser excluída; venda + parcelas criadas atomicamente por `create_sale`.
- **Cadastro público bloqueado**: um gatilho em `auth.users` só aceita e-mails de `allowed_emails`. Para criar/alterar logins use `supabase/create-user.sql`.
- O frontend usa **somente a chave pública (anon/publishable)**. Nunca use `service_role` no navegador.

Teste de isolamento/segurança: `node --experimental-websocket scripts/rls-check.mjs` (variáveis no cabeçalho do arquivo).

## Publicação (Render Static Site)

- Build: `npm ci && npm run build` · Publish dir: `dist`.
- Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Rotas: o app usa **HashRouter** (`/#/clientes`), então atualizar a página nunca dá 404, sem configuração de servidor. (O build ainda gera `dist/404.html`, e o `render.yaml` traz o rewrite para quem usar Blueprint.)

## Importar a planilha (opcional)

*Ajustes → Importar da planilha* lê as colunas digitadas do `.xlsx` (vendas, parcelas pagas, boletos), mostra um resumo e pula duplicidades. **A planilha de demonstração é fictícia — não importe para o banco definitivo.**

## Testes e pendências

Veja `docs/TESTES.md`.
