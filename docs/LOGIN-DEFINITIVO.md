# Login definitivo da Amanda — preparação e passo a passo

**Status: preparado e validado em ambiente isolado. NADA foi alterado na conta de produção.**
Aguardando: (1) o e-mail real da Amanda, (2) a configuração de e-mail no Supabase (abaixo) e (3) autorização expressa.

## Situação atual (consulta somente-leitura em produção)

- 1 usuária: `f0c31479-52ed-4e6c-b9a6-6e789a71e54e`, e-mail provisório fictício `amanda@financeiro-amanda.app`, e-mail confirmado, 1 identidade (`email`), 1 perfil, 1 linha em `financial_settings`. Nenhum cliente/venda/boleto ainda.
- `allowed_emails`: só o e-mail provisório. Gatilho `block_unlisted_signups` ativo (cadastro público bloqueado).
- A senha provisória foi mostrada numa conversa — **deve ser invalidada** (o script faz isso).

## O que foi preparado

| Item | Arquivo |
|---|---|
| Troca de e-mail (mesmo id, mesma conta) + invalida senha provisória + encerra sessões + ajusta `allowed_emails` | `supabase/change-email.sql` |
| Reversão | `supabase/rollbacks/change-email.down.sql` |
| Teste da troca em Postgres isolado (PGlite) | `npm run test:email-swap` (23 verificações) |
| Telas de recuperação: “Esqueci minha senha / primeiro acesso” e “Crie a sua senha” (link do e-mail) | `src/pages/Login.tsx`, `src/pages/NewPassword.tsx`, `src/lib/authLink.ts`, `src/lib/password.ts` |

Ninguém (nem a equipe técnica) precisa conhecer a senha: a Amanda recebe o link no e-mail dela e **ela mesma** cria a senha (mínimo 10 caracteres). A senha não é registrada, exibida nem salva em arquivos. Ao definir a nova senha, as outras sessões são encerradas.

## Passo a passo da publicação (depois da autorização)

1. **Supabase → Authentication → URL Configuration**: *Site URL* = `https://financeiro-amanda.onrender.com` e, em *Redirect URLs*, `https://financeiro-amanda.onrender.com/**`. (Sem isso o link do e-mail abre no endereço errado.)
2. **Supabase → Authentication → SMTP Settings**: configurar um SMTP próprio (ex.: Resend/Brevo/Gmail com senha de app). O envio padrão do Supabase só entrega para e-mails de membros do time e é limitado a poucos por hora — **não entregaria para a Amanda**.
3. Publicar este branch (login/recuperação) na `master` (Render).
4. Rodar `supabase/change-email.sql` no SQL Editor com o e-mail real (uma única vez; ele aborta sem alterar nada se algo estiver errado).
5. Amanda abre o app → **Esqueci minha senha / primeiro acesso** → recebe o link → cria a senha.
6. Conferir (checklist abaixo).

## Checklist de verificação

- [ ] Login com o e-mail novo e a senha criada pela Amanda funciona; **sair** (Ajustes → Sair) e entrar de novo funcionam.
- [ ] O e-mail provisório + senha provisória **não entram mais** (“E-mail ou senha incorretos”).
- [ ] `select email from public.allowed_emails;` → só o e-mail real.
- [ ] `select id, email from auth.users;` → mesmo id `f0c31479-…`, e-mail real.
- [ ] Tentar cadastrar outro e-mail pela API → “Cadastro nao permitido”.
- [ ] “Esqueci minha senha” com o e-mail real envia o link; link usado duas vezes ou vencido mostra “Este link expirou…”.
- [ ] Dados financeiros e configurações iguais aos de antes.

## Pendências / riscos

- Depende de SMTP configurado e das URLs do Supabase (ações no painel; não há ferramenta para fazê-las daqui).
- Em iPhone, abrir o link do e-mail abre o Safari; depois, ao abrir o app pela tela de início, pode pedir o login uma vez.
- Homologação em aparelho físico segue pendente.
