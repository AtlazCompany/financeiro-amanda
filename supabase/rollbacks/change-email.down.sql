-- REVERTE a troca de e-mail: volta ao e-mail provisorio (mesmo id). A senha provisoria antiga NAO e restaurada
-- (use "Esqueci minha senha" ou defina uma nova senha pelo painel). Troque o texto entre aspas em "v_cur" pelo e-mail atual.
do $$
declare
  v_cur text := lower(btrim('EMAIL-REAL-AQUI'));
  v_old constant text := 'amanda@financeiro-amanda.app';
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = v_cur;
  if v_id is null then raise exception 'Conta com e-mail % nao encontrada', v_cur; end if;
  insert into public.allowed_emails(email) values (v_old) on conflict do nothing;
  update auth.users set email = v_old, encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), updated_at = now() where id = v_id;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_old), updated_at = now() where user_id = v_id and provider = 'email';
  delete from auth.sessions where user_id = v_id;
  delete from public.allowed_emails where lower(email) = v_cur;
end $$;
