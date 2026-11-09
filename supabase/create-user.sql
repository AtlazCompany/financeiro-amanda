-- Cria (ou prepara) o login de uma usuaria. Execute no SQL Editor do Supabase.
-- Troque EMAIL e SENHA abaixo. NAO salve a senha neste arquivo nem no Git.
-- O cadastro publico esta bloqueado: so e-mails listados em public.allowed_emails conseguem existir.

insert into public.allowed_emails(email) values ('EMAIL-AQUI') on conflict do nothing;

with u as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'EMAIL-AQUI', extensions.crypt('SENHA-AQUI', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')
  returning id, email
), i as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now() from u
  returning user_id
), p as (
  insert into public.profiles(id, display_name) select user_id, 'Amanda' from i returning id
)
insert into public.financial_settings(user_id) select id from p;

-- Para TROCAR e-mail/senha depois: Supabase > Authentication > Users > (usuaria) > editar.
-- (Se trocar o e-mail, inclua o novo em public.allowed_emails.)
