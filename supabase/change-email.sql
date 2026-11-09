-- TROCA DEFINITIVA do e-mail provisorio da Amanda pelo e-mail real, PRESERVANDO o mesmo id de usuaria
-- (todos os registros financeiros continuam vinculados). Rode no SQL Editor do Supabase.
--
-- Antes: troque o texto entre aspas na linha "v_new" (abaixo) pelo e-mail real. NAO coloque senha neste arquivo.
-- O que faz (tudo numa transacao; se algo falhar, nada muda):
--   1. valida o novo e-mail e que ele ainda nao existe;
--   2. autoriza o novo e-mail em public.allowed_emails;
--   3. troca o e-mail em auth.users e em auth.identities (mesmo id);
--   4. INVALIDA a senha provisoria (hash aleatorio, nunca exibido) e encerra todas as sessoes;
--   5. remove o e-mail provisorio de allowed_emails (nao pode mais ser usado para cadastro);
--   6. confere que ficou exatamente 1 e-mail autorizado.
-- Depois: a Amanda abre o app > "Esqueci minha senha" > recebe o link no e-mail real e define a propria senha.

do $$
declare
  v_old constant text := 'amanda@financeiro-amanda.app';
  v_new text := lower(btrim('NOVO-EMAIL-AQUI'));
  v_id uuid;
  v_allowed int;
begin
  if v_new !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or v_new = v_old then
    raise exception 'Novo e-mail invalido ou igual ao provisorio: %', v_new;
  end if;
  select id into v_id from auth.users where lower(email) = v_old;
  if v_id is null then raise exception 'Conta provisoria % nao encontrada (a troca ja foi feita?)', v_old; end if;
  if exists (select 1 from auth.users where lower(email) = v_new) then
    raise exception 'Ja existe uma conta com o e-mail %', v_new;
  end if;

  insert into public.allowed_emails(email) values (v_new) on conflict do nothing;

  update auth.users set
    email = v_new,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '',
    updated_at = now()
  where id = v_id;

  update auth.identities set
    identity_data = identity_data || jsonb_build_object('email', v_new, 'email_verified', true),
    updated_at = now()
  where user_id = v_id and provider = 'email';

  delete from auth.sessions where user_id = v_id;  -- derruba tambem os refresh tokens
  delete from public.allowed_emails where lower(email) = v_old;

  select count(*) into v_allowed from public.allowed_emails;
  if v_allowed <> 1 then raise exception 'Esperado 1 e-mail autorizado, encontrado %', v_allowed; end if;
  raise notice 'OK: usuaria % agora usa o e-mail novo; senha provisoria invalidada.', v_id;
end $$;
