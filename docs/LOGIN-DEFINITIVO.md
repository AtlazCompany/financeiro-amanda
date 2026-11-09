# Login definitivo da Amanda — ativação por link (sem SMTP)

**Status (10/11/2026): preparado e validado em ambiente isolado. Nada foi alterado na produção** (sem deploy, sem troca de e-mail, sem link gerado). Aguarda autorização expressa.
O e-mail definitivo fica só no arquivo local `supabase/local/change-email.amanda.sql` (ignorado pelo Git; o repositório é público).

## Como funciona

1. **Deploy** do app com a tela “Bem-vinda — Ativar meu acesso” e a tela “Crie a sua senha”.
2. **Troca do e-mail** (`supabase/local/change-email.amanda.sql`): mesma conta/ID, dados intactos, senha e e-mail provisórios invalidados, sessões encerradas, só o e-mail definitivo autorizado. Transacional e reversível (`supabase/rollbacks/change-email.down.sql`).
3. **Gerar o link** com a API oficial *Auth Admin* `generateLink({ type: 'recovery' })` — sem enviar e-mail. É feito **na máquina do administrador**, com `scripts/primeiro-acesso.ps1`:
   - o script pede a chave `service_role` de forma oculta (Supabase → Project Settings → API), usa só em memória e a apaga ao terminar;
   - confere que a conta é a certa (mesmo ID, e-mail definitivo, única usuária);
   - **copia o link para a área de transferência sem exibi-lo** (não grava em arquivo nem em log);
   - a chave `service_role` **nunca** deve ser colada em chat, arquivo ou commit.
4. Colar o link na conversa de WhatsApp com a Amanda (e limpar a área de transferência).
5. Amanda abre **no Safari do iPhone**, cria a **própria senha** (mín. 10 caracteres) e entra. Ninguém mais conhece a senha.

### Dois formatos de link (escolha)

| Modo | Link | Observação |
|---|---|---|
| **Oficial** (padrão) | `action_link` devolvido pelo Supabase (`…/auth/v1/verify?token=…`) | Uso único. **Risco:** a pré-visualização de links do WhatsApp (feita no aparelho de quem envia) pode abrir o link e **gastá-lo** antes da Amanda; nesse caso basta gerar outro. |
| **Anti-prévia** (`-AntiPrevia`) | Página do app `…/#/ativar?th=<hashed_token oficial>` | O código só é consumido quando a Amanda **toca em “Ativar meu acesso”** (via `verifyOtp`, API oficial); prévias de link não o consomem. Usa o `hashed_token` que o próprio Supabase devolve. |

### Validade

O link vale ~1 hora (configuração “Email OTP Expiration” do Supabase, máx. 24 h). Gere somente quando a Amanda estiver pronta para abrir. Se vencer ou for usado, gere outro (o anterior deixa de valer).

## Pré-requisitos verificados (somente leitura)

- Site URL = `https://financeiro-amanda.onrender.com` e Redirect URLs permite o site ✅ (`npm run verify:login`).
- Conta provisória única, sem dados financeiros ainda; cadastro público bloqueado ✅.
- “Esqueci minha senha” por e-mail fica **oculto** (exige SMTP); o login mostra “Peça um novo link de acesso”. Para reativar depois de configurar SMTP: variável `VITE_EMAIL_RESET=1` no Render.

## Ordem da execução (após autorização)

1. Merge/deploy (Render) → conferir `https://…/#/ativar` carrega.
2. `supabase/local/change-email.amanda.sql` (SQL Editor ou assistente).
3. Administrador roda `.\scripts\primeiro-acesso.ps1` (ou `-AntiPrevia`) → link na área de transferência.
4. Enviar pelo WhatsApp com a mensagem abaixo.
5. Conferir (somente leitura): `OLD_EMAIL=… OLD_PASS=… npm run verify:login` (provisório + senha antiga não entram), `select id,email,last_sign_in_at from auth.users;`, `select email from public.allowed_emails;`.

## Mensagem para a Amanda (sem o link)

> Oi, Amanda! Segue o link para ativar o seu acesso ao Financeiro Amanda. Abra **no Safari** do iPhone, toque em **“Ativar meu acesso”**, crie a sua senha (mínimo 10 caracteres) e pronto. O link é de uso único e vale por pouco tempo — se não abrir, me avise que eu mando outro. Depois, para ter o ícone na tela inicial: Safari → **Compartilhar → Adicionar à Tela de Início**. Na primeira vez que abrir pelo ícone, entre com o seu e-mail e a senha que você criou.

## Reversão

`supabase/rollbacks/change-email.down.sql` devolve o e-mail provisório (mesmo ID); a senha antiga não é restaurada (gere novo link).
