# Testes — Financeiro Amanda

Executados em 09/11/2026 contra o projeto Supabase `financeiro-amanda` e o build de produção servido localmente (`vite preview`). Dados de teste removidos ao final (banco vazio).

## Automatizados

| Suíte | Resultado |
|---|---|
| `npm test` — 32 testes das regras financeiras (`src/lib/finance.test.ts`) | **32/32 passaram** |
| `tsc -b` (TypeScript estrito) e `vite build` | sem erros |
| `scripts/rls-check.mjs` — 16 verificações de segurança com duas contas | **16/16 passaram** |

Os testes reproduzem os números da planilha de demonstração (ex.: novembro/2026 — recebido R$ 135,00; a receber R$ 618,30; saldo R$ 623,10; faltam R$ 247,40; controle mensal set/out/nov/dez) e cobrem: centavos na última parcela (R$ 100 em 3x → 33,33+33,33+33,34; em 6x → 16,67×5+16,65), EDATE (fim de mês/virada de ano), saldo inicial uma única vez, parcelas atrasadas fora do caixa e da projeção, projeção cronológica sem reutilizar o mesmo saldo, boletos do mesmo dia, correção de pagamento e anos diferentes.

## Segurança (Supabase)

- Sem login: leitura, escrita e `create_sale` negados (`permission denied`).
- Cadastro público (`signUp`) **bloqueado** por gatilho em `auth.users`.
- Conta B não vê, não altera e não exclui dados da conta A; não cria venda usando cliente da A (FK composta); não grava com `user_id` forjado.
- `create_sale` rejeita soma de parcelas diferente do total; parcela paga não pode ser excluída.
- Advisors do Supabase: apenas INFO (`allowed_emails` sem policy, intencional) e aviso de proteção de senhas vazadas (exige plano Pro).

## Interface (Chrome, viewports simulados de 390 px e 360 px + desktop)

Executado pela automação do navegador sobre o build real e o banco real:

- Cadastro de cliente (formulário e dentro da venda) e link do WhatsApp (`wa.me/55…`).
- Venda à vista; venda parcelada com prévia das parcelas; centavos corrigidos.
- Marcar parcela como paga (confirmação com data editável), **corrigir/desfazer** pagamento; totais, saldo e dashboard atualizam na hora.
- Cadastro de boleto, boleto vencido (vermelho), vencendo em breve (amarelo), pagamento do boleto, correção.
- Parcela atrasada (cliente com “N atrasada(s)”), alerta de caixa insuficiente, troca de mês/ano na tela inicial e no Controle mensal.
- Persistência: recarregar a página mantém sessão e dados.
- Sem rolagem horizontal em nenhuma das 13 telas (360 px e 390 px); campos com fonte ≥ 16 px (sem zoom do iOS); alvos de toque ≥ 44 × 44 px.
- Bug encontrado e corrigido durante o teste: máscara de valor impedia salvar (validação `pattern`) — removida e formulários com `noValidate`.

## Limites desta homologação (leia)

- **Não houve teste em iPhone físico nem no Safari real.** Safe areas, teclado virtual, seletor de datas nativo do iOS, “Adicionar à Tela de Início” e o modo standalone foram implementados conforme as boas práticas do iOS (viewport-fit=cover, `env(safe-area-inset-*)`, `visualViewport`, `inputMode="numeric"`, `type="date"`, meta tags Apple, ícone 180 px, manifesto), mas **precisam de homologação no aparelho da Amanda**.
- O **formulário de login não foi preenchido pela automação** (política de não digitar senhas em campos). O login por e-mail/senha foi validado via API e a sessão persistente, injetando uma sessão válida no navegador. Faça um login manual na primeira abertura.
- Não há modo offline (decisão do projeto).

## Produção (Render) — 09/11/2026

URL: https://financeiro-amanda.onrender.com (Static Site, deploy `live`, commit `7e1ff32`).

- `/`, `/manifest.json`, `/sw.js`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-maskable-512.png` respondem 200 com o tipo correto; meta tags Apple e `viewport-fit=cover` presentes no HTML publicado.
- Sem sessão, a rota protegida redireciona para `#/login`.
- Com sessão: dashboard carrega do banco real; criar cliente → recarregar a página em `#/clientes` mantém sessão e dados; excluir cliente funciona. Dados de teste removidos (banco vazio).
- Rotas usam HashRouter: atualizar a página em qualquer tela não dá 404 (o servidor do Render devolvia 404 para `/clientes` quando se usava caminho comum).
- Repositório: https://github.com/AtlazCompany/financeiro-amanda (tornado **público** a pedido, para o Render conseguir clonar; não contém senhas nem chaves privadas).
