-- Migration: 0009_embeddings.sql
-- Источник: AI Architecture §4 ("отдельная векторная таблица
-- plant_embeddings(plant_id, embedding)") — embedding-канал поверх tsvector
-- (System Architecture §9.2, точка масштабирования поиска).
--
-- [решено самостоятельно] Таблица создаётся пустой и остаётся пустой в этой
-- сессии: нет ANTHROPIC_API_KEY/embedding-провайдера в песочнице сборки (тот же
-- зазор, что у AI-описаний Phase 3 и фото-проверки Phase 5, см. TODO.md).
-- Поиск при этом не деградирует до ошибки — searchPlants() (lib/queries/catalog.ts)
-- уже использует tsvector + pg_trgm fallback (0008_search.sql); embedding-канал
-- подключается сюда без изменения UI, как только появится реальный ключ и
-- фоновый процесс, заполняющий эту таблицу.

create table plant_embeddings (
  plant_id uuid primary key references plants(id) on delete cascade,
  embedding vector(1536),
  model text not null default 'voyage-3',
  updated_at timestamptz default now()
);

create index idx_plant_embeddings_vector on plant_embeddings using ivfflat (embedding vector_cosine_ops);

alter table plant_embeddings enable row level security;

create policy "public_read_plant_embeddings" on plant_embeddings for select using (true);
create policy "supplier_manage_own_plant_embeddings" on plant_embeddings for all
  using (plant_id in (select id from plants where company_id = auth_company_id()))
  with check (plant_id in (select id from plants where company_id = auth_company_id()));

-- security invoker — подчиняется той же публичной read-политике выше, ничего не обходит.
create or replace function match_plant_embeddings(query_embedding vector(1536), match_count int default 10)
returns table (plant_id uuid, similarity real)
language sql
stable
as $$
  select pe.plant_id, 1 - (pe.embedding <=> query_embedding) as similarity
  from plant_embeddings pe
  join plants p on p.id = pe.plant_id
  where p.status = 'active'
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;
