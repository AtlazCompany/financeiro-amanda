# Login definitivo da Amanda — preparação, verificações e passo a passo

**Status (10/11/2026): tudo preparado e validado em ambiente isolado. NADA foi alterado na produção** (nem deploy, nem migração, nem conta). Falta: 2 configurações manuais no painel Supabase, a prova de entrega do e-mail e a autorização expressa.

O e-mail definitivo foi informado e está **somente** no arquivo local `supabase/local/change-email.amanda.sql` (ignorado pelo Git; o repositório é público e não contém o e-mail pessoal).

## Verificado em produção (somente leitura, sem efeitos)

| Item | Resultado |
|---|---|
| Conta provisória | 1 usuária (`f0c31479-52ed-4e6c-b9a6-6e789a71e54e`), e-mail fictício, 1 identidade, 1 perfil, 1 configuração; sem dados financeiros ainda |
| `allowed_emails` / cadastro público | só o e-mail provisório; cadastro de qualquer outro e-mail → “Cadastro nao permitido” |
| Recuperação para e-mail inexistente | resposta 200 idêntica (não revela quem existe) |
| **Site URL do Auth** | ❌ ainda `http://localhost:3000` (padrão) |
| **Redirect URLs** | ❌ o endereço do site **não** está permitido (o link cairia em `localhost:3000`) |
| **SMTP** | ⚠️ não dá para ler daqui. O envio padrão do Supabase só entrega a e-mails de membros do time e tem limite baixo/hora |

(A Site URL e a lista de redirecionamentos são detectadas sem efeito colateral: `GET /auth/v1/verify?token=invalido` redireciona para a Site URL — ou para o `redirect_to`, se permitido. O script `npm run verify:login` faz essa conferência.)

## Intervenções manuais indispensáveis (painel Supabase → Authentication)

1. **URL Configuration** → *Site URL*: `https://financeiro-amanda.onrender.com`; *Redirect URLs*: `https://financeiro-amanda.onrender.com/**`.
2. **SMTP Settings** → ativar SMTP próprio (Resend, Brevo ou Gmail com senha de app), remetente reconhecível (ex.: “Financeiro Amanda”). Sem isso o e-mail não chega à Amanda.

Depois de (1), me avise: eu confiro sozinho com `npm run verify:login` (deve mostrar 2 PASS nas duas primeiras linhas).

## Prova de entrega (antes de trocar a conta)

Só é possível enviar para a Amanda de duas formas, ambas com ação real/consentida:
- **Recomendado:** depois de configurar o SMTP, use o botão/endpoint de *teste de envio* do próprio provedor (Resend/Brevo/Gmail) para `amandamoraesx01@…` e peça a ela que confirme o recebimento (veja também o spam). Nada muda na conta.
- Alternativa: autorizar o envio do e-mail de recuperação logo após a troca (passo 5 abaixo) — se não chegar, o rollback devolve a conta ao estado anterior.

## Ordem da publicação (depois da autorização expressa)

1. Painel: itens 1 e 2 acima + prova de entrega.
2. Publicar a branch `feature/login-definitivo` na `master` (Render) — inclui “Esqueci minha senha / primeiro acesso” e “Crie a sua senha”.
3. Rodar `supabase/local/change-email.amanda.sql` no SQL Editor (ou pelo assistente, com autorização). Ele é transacional: valida tudo e só então troca o e-mail **mantendo o mesmo ID**, invalida a senha provisória (hash aleatório descartado), encerra todas as sessões, autoriza só o e-mail definitivo e remove o provisório de `allowed_emails`.
4. Amanda abre o app → **Esqueci minha senha / primeiro acesso** → digita o e-mail → recebe o link → **cria a própria senha** (mín. 10 caracteres). Ninguém mais conhece a senha; ela não passa por mim, arquivos ou logs.
5. Conferir: `OLD_EMAIL=… OLD_PASS=… npm run verify:login` (provisório + senha antiga **não** entram; cadastro público bloqueado) e, com autorização, `NEW_EMAIL=… SEND_RECOVERY=1 …` para disparar o e-mail de recuperação.

## Checklist final

- [ ] Login com o e-mail definitivo e a senha criada pela Amanda; sair (Ajustes → Sair) e entrar de novo.
- [ ] E-mail provisório + senha provisória: “E-mail ou senha incorretos”.
- [ ] `select email from public.allowed_emails;` → só o e-mail definitivo.
- [ ] `select id, email from auth.users;` → mesmo id `f0c31479-…`, e-mail definitivo.
- [ ] Dados financeiros e configurações iguais aos de antes (contagens e saldo inicial).
- [ ] “Esqueci minha senha” envia o link; link usado duas vezes/vencido mostra “Este link expirou…”.

## Reversão

`supabase/rollbacks/change-email.down.sql` devolve o e-mail provisório (mesmo ID) e a autorização; a senha antiga não é restaurada (use o fluxo de recuperação).

## Observações

- iPhone: o link do e-mail abre no Safari; ao abrir pelo ícone da tela de início pode ser preciso entrar uma vez.
- Homologação em aparelho físico segue pendente.
