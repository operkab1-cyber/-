-- Migration: 0008_search.sql
-- Источник: System Architecture §9.1 — "поддержка опечаток и частичного совпадения
-- через pg_trgm (similarity())". search_vector (tsvector) уже в 0001; здесь —
-- недостающее расширение и fallback-функция для нечёткого поиска по названию,
-- когда полнотекстовый поиск не дал результатов (например, опечатка).

create extension if not exists pg_trgm;

create index idx_translations_value_trgm on translations using gin (value gin_trgm_ops);

-- security invoker (не definer) — вызывающий видит ровно то, что ему разрешает RLS
-- на translations/plants (публичное чтение активных товаров, см. 0001/0007).
create or replace function search_plants_fuzzy(query_text text)
returns table (plant_id uuid, score real)
language sql
stable
as $$
  select t.entity_id as plant_id, similarity(t.value, query_text) as score
  from translations t
  join plants p on p.id = t.entity_id
  where t.entity_type = 'plant'
    and t.field = 'name'
    and p.status = 'active'
    and similarity(t.value, query_text) > 0.15
  order by score desc
  limit 20;
$$;
