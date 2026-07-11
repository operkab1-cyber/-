-- Migration: 0010_realtime_prices.sql
-- Источник: Tamga_Green_Admin_Panel.md §4.1 ("Изменение сразу видно покупателям,
-- стоящим на странице товара, через Realtime-канал (Этап 4, раздел 6.4)") +
-- System_Architecture.md §6.4 (Supabase Realtime).
--
-- Каждый Supabase-проект уже создаёт публикацию `supabase_realtime` (часть
-- платформы, не миграций) — таблицу нужно явно в неё добавить, чтобы клиенты
-- могли подписаться на postgres_changes. В локальной нативной Postgres (без
-- Docker/Supabase, см. TODO.md с Phase 0) такой публикации нет, поэтому блок
-- обёрнут проверкой существования — миграция применяется одинаково и там, и
-- там, не падая на стенде без реального Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table prices;
  end if;
end $$;
