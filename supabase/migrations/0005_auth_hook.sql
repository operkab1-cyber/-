-- Migration: 0005_auth_hook.sql
-- Источник: Tamga_Green_System_Architecture.md §6.1/§12.1 — "JWT содержит role и
-- company_id через custom claims (Supabase Auth Hook)".
--
-- [решено самостоятельно] RLS-политики (0001-0004) уже используют auth_role()/
-- auth_company_id() — функции, которые читают users напрямую (security definer),
-- а не доверяют claim'ам из токена. Это осознанно оставлено как есть: RLS —
-- последний рубеж защиты (§12.1, "даже если серверная проверка роли будет обойдена,
-- база данных не отдаст чужие данные"), и живой запрос к users гарантирует, что
-- политика не сработает на основании устаревшего claim (роль сменилась, а токен
-- ещё не обновился). Custom claims из этого хука нужны для другого: Next.js
-- middleware (§12.1, "первый рубеж") декодирует JWT на edge без похода в БД —
-- вот там claim'ы role/company_id и используются.

create or replace function custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_role text;
  v_company_id uuid;
begin
  select role, company_id into v_role, v_company_id
  from users
  where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);

  if v_role is not null then
    claims := jsonb_set(claims, '{role}', to_jsonb(v_role));
  end if;
  if v_company_id is not null then
    claims := jsonb_set(claims, '{company_id}', to_jsonb(v_company_id::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Supabase Auth (роль supabase_auth_admin) должна иметь право выполнить хук и
-- прочитать users, но не более того — сама функция security invoker (не definer),
-- права на чтение users выдаются явно только этой служебной роли.
grant usage on schema public to supabase_auth_admin;
grant execute on function custom_access_token_hook to supabase_auth_admin;
revoke execute on function custom_access_token_hook from authenticated, anon, public;

grant select on users to supabase_auth_admin;
create policy "auth_admin_read_users_for_claims" on users for select
  to supabase_auth_admin using (true);
