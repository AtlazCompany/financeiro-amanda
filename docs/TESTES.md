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

---

# Rodada 2 — Lucro + redesign rosa (branch `feature/lucro-redesign`, 10/11/2026)

Validado primeiro em ambiente isolado; depois, **com autorização**, a migração 004 foi aplicada no Supabase e a `master` publicada no Render (commit `5fef25f`).

| Suíte | Resultado |
|---|---|
| `npm test` — regras financeiras (32) + lucro (20) | **52/52 passaram** |
| `npm run test:migration` — migração 004 em Postgres isolado (PGlite) | **21/21 passaram** |
| `tsc -b` + `vite build` (produção) e build com backend falso | sem erros |

## Fórmulas de lucro (`src/lib/profit.test.ts`)
- Exemplo do enunciado: custo R$ 16 → venda R$ 30 = lucro R$ 14,00, margem 46,67%.
- Quantidade 3; desconto (2 × R$ 30 − R$ 10 = R$ 50 → lucro R$ 18 e 36%); prejuízo (preço < custo) com aviso e margem negativa; lucro zero não é prejuízo; margem nula com receita ≤ 0; desconto maior que o valor é sinalizado.
- Parcelamento com centavos **sobre o valor após desconto** (3 × R$ 30 − R$ 10 = R$ 80 em 3x → 26,67 + 26,67 + 26,66).
- Vendas antigas (custo `null`) ⇒ sem lucro e sem margem; custo zero informado é diferente de “não informado”.
- Indicadores mensais (lucro, custo, margem, vendas sem custo), mês sem vendas, evolução do ano.
- **Boletos não reduzem o lucro**: lucro idêntico com/sem boleto; o boleto só sai do caixa (sem dupla contagem).
- Regressão de caixa, projeção de boletos, clientes e parcelas (os 32 testes anteriores seguem verdes).

## Migração (Postgres isolado)
Dados anteriores preservados (id, total, parcelas); vendas antigas ficam com custo `NULL`; `create_sale` antiga continua funcionando (app em produção não quebra); nova função valida soma das parcelas, desconto e quantidade; constraints (custo negativo; total ≠ qtd × preço − desconto); custo editável e removível; RLS isola usuárias; `anon` sem acesso; **rollback** remove só as colunas/função novas e mantém vendas; migração reaplicável.

## Interface (build com backend falso, Chrome, 390 px / 360 px / desktop)
- Formulário de venda em 4 etapas com lucro ao vivo: R$ 16 → R$ 30 = **R$ 14,00 / 46,67%**; quantidade, desconto, prejuízo (aviso, não bloqueia), custo em branco (“Custo não informado”), parcelas 16,67/16,67/16,66.
- Venda salva: detalhe com lucro/margem/quantidade/preço/desconto/custo; lista de vendas com lucro por venda; **venda antiga** mostra “Custo não informado” e permite informar/editar custo (total e parcelas não mudam).
- Início: lucro bruto, margem, vendido, custo do mês **separados** do “Dinheiro disponível”; conferido contra o cálculo manual (R$ 186,00 / 45,59% no cenário de teste). Controle mensal com lucro por mês e no ano.
- **Contraste (WCAG AA, medido no DOM)**: 0 textos abaixo de 4,5:1 (3:1 em texto grande) em 10 telas, incluindo login; corrigidos 3 casos (subtítulo, cinza claro, vermelho).
- Responsividade: 13 telas em 360 e 390 px sem rolagem horizontal; fontes de campos ≥ 16 px; alvos ≥ 44 px (parcelas viram 3 colunas abaixo de 370 px).
- Segurança: sem segredos no repositório (`git grep`); só chave pública no frontend; RLS inalterada. `npm audit`: aviso conhecido da biblioteca `xlsx` (usada só na importação opcional, com arquivo escolhido pela própria usuária; sem correção publicada).

## Produção (após autorização) — 09/11/2026
- Migração 004 aplicada; advisors de segurança sem novos alertas; `create_sale_with_profit` e `create_sale` (antiga) funcionam; `UPDATE quantity` que quebraria o total é rejeitado pela constraint.
- Site publicado (`financeiro-amanda.onrender.com`): novo tema, `theme-color` #F8E9EE, ícones rosa e manifesto atualizados (HTTP 200).
- Teste na URL real: venda com custo R$ 16 / preço R$ 30 em 3x → lucro R$ 14,00 e 46,67% ao vivo, no detalhe e no Início (vendido R$ 30, custo R$ 16); venda e cliente excluídos em seguida (banco vazio).

## Pendências desta rodada
- Homologação em **iPhone físico/Safari** (teclado, safe areas, seletor de datas, modo standalone) continua pendente.

---

# Rodada 3 — Login definitivo (branch `feature/login-definitivo`, 10/11/2026)

**Nenhuma alteração em produção.** Só consultas de leitura no Supabase; o app publicado e a conta provisória continuam como estavam.

| Verificação | Resultado |
|---|---|
| `npm test` (inclui `auth.test.ts`: link de recuperação e regras de senha) | **60/60** |
| `npm run test:email-swap` — troca de e-mail em Postgres isolado | **23/23** |
| `npm run test:migration` (regressão) · `tsc -b` · build de produção | ok |

Troca de e-mail (isolada): mesmo id de usuária; e-mail normalizado; identidade atualizada; senha provisória invalidada (não confere mais); sessões/refresh tokens encerrados; `allowed_emails` só com o e-mail novo; e-mail provisório e qualquer outro **bloqueados** no cadastro; dados financeiros, perfil e configurações intactos e vinculados ao mesmo id; entradas inválidas (e-mail ruim, igual ao provisório, placeholder, 2ª execução) abortam sem alterar nada; rollback restaura.

Interface (backend de teste local, credencial **falsa**): senha errada → “E-mail ou senha incorretos”; login; sair; rota protegida → login; “Esqueci minha senha” (resposta genérica, `redirectTo` correto); link de recuperação válido → “Crie a sua senha” (token removido da URL; senha curta/diferente recusadas; senha igual à anterior recusada; salvar → entra no app com as outras sessões encerradas); link expirado → mensagem no login; `/nova-senha` sem sessão → login.

Produção (somente leitura / sem efeito): `recover` para e-mail inexistente responde 200 sem revelar nada; cadastro público segue bloqueado.

Não verificável daqui (depende de ações no painel Supabase): Site URL/Redirect URLs e SMTP — ver `docs/LOGIN-DEFINITIVO.md`.

## Rodada 4 — preparação final do login definitivo (10/11/2026) — sem alterar produção

- `email-swap-check` ampliado: **44 verificações** (modelo + o **arquivo final local** com o e-mail definitivo, executado sem alterações em banco isolado): mesmo id, dados intactos, senha provisória e provisório invalidados, sessões encerradas, `allowed_emails` só com o e-mail novo, **isolamento (RLS)** — a usuária continua vendo tudo e outra usuária não vê nem altera nada —, entradas inválidas abortam, rollback restaura.
- Novo `npm run verify:login` (somente API pública): detecta Site URL/Redirect URLs sem efeito colateral. Resultado em produção hoje: **Site URL = `http://localhost:3000` e redirect do site não permitido (2 FAIL)** — exige a configuração manual descrita em `docs/LOGIN-DEFINITIVO.md`; cadastro público bloqueado e recuperação genérica (PASS).
- Branch `feature/login-definitivo` contém a `master` (merge fast-forward possível); 60 testes unitários, migração isolada e build de produção passando.
