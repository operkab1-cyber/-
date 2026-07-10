-- Migration: 0001_init_catalog.sql
-- Источник: Tamga_Green_Database_Design.md, разделы 3 и 6
-- Включает: каталог (categories/plants/plant_images/attributes/availability/prices)
-- и переводы (translations). Транзакционная часть (companies/orders/...) из
-- Tamga_Green_System_Architecture.md добавляется отдельной миграцией 0002 —
-- не включена сюда, чтобы Phase 1/3 можно было проверить независимо.
--
-- [решено самостоятельно] Architecture §9.1 проектирует search_vector как триггер
-- над products.name/description (jsonb), но Database Design §8 выносит name/description
-- в отдельную таблицу translations — на момент INSERT/UPDATE строки plants перевода
-- ещё не существует. Поэтому search_vector поддерживается двумя триггерами: один на
-- plants (пересчёт при смене latin_name), другой на translations (пересчёт при
-- добавлении/смене name или description для entity_type='plant') — см. конец файла.

create extension if not exists "pgcrypto";

-- ==== КАТЕГОРИИ ====
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  slug text unique not null,
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ==== РАСТЕНИЯ ====
create table plants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,  -- FK на companies добавляется в 0002 после создания таблицы companies
  category_id uuid references categories(id),
  slug text unique not null,
  latin_name text,
  sku text,
  unit text not null default 'pcs',
  status text not null default 'draft'
    check (status in ('draft','active','hidden','out_of_stock','archived')),
  is_plant boolean not null default true,
  min_order_qty numeric default 1,
  cover_image_id uuid,
  search_vector tsvector,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table plant_images (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  file_path text not null,
  alt_text text,
  position int default 0,
  is_cover boolean default false
);

alter table plants
  add constraint fk_cover_image foreign key (cover_image_id)
  references plant_images(id) on delete set null;

-- ==== АТРИБУТЫ (EAV) ====
create table attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  code text unique not null,
  data_type text not null check (data_type in ('text','number','boolean','enum')),
  unit text,
  enum_options jsonb,
  is_filterable boolean default true,
  sort_order int default 0
);

create table plant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  attribute_id uuid references attributes(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  unique (plant_id, attribute_id)
);

-- ==== ОСТАТКИ И ЦЕНЫ ====
create table availability (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  location text,
  quantity numeric not null default 0,
  season_start date,
  season_end date,
  updated_at timestamptz default now()
);

create table prices (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  min_qty numeric not null default 1,
  price numeric(10,2) not null,
  currency text not null default 'EUR',
  valid_from date default current_date,
  valid_to date
);

-- ==== ПЕРЕВОДЫ ====
create table translations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'plant','category','landscape_solution','project',
    'blog_post','blog_category','faq_item','faq_category','setting'
  )),
  entity_id uuid not null,
  field text not null,
  locale text not null,
  value text,
  updated_at timestamptz default now(),
  unique (entity_type, entity_id, field, locale)
);

-- ==== ИНДЕКСЫ ====
create index idx_plants_category on plants(category_id);
create index idx_plants_status on plants(status) where status = 'active';
create index idx_plant_attr_values_plant on plant_attribute_values(plant_id);
create index idx_availability_plant on availability(plant_id);
create index idx_prices_plant on prices(plant_id, min_qty);
create index idx_translations_lookup on translations(entity_type, entity_id, locale);
create index idx_plants_search on plants using gin(search_vector);

-- ==== ПОЛНОТЕКСТОВЫЙ ПОИСК (Architecture §9.1, адаптировано под translations — см. шапку файла) ====
create or replace function plants_refresh_search_vector(p_plant_id uuid) returns void as $$
declare
  v_latin text;
  v_name_ru text;
  v_name_en text;
  v_desc_ru text;
  v_desc_en text;
begin
  select latin_name into v_latin from plants where id = p_plant_id;
  select value into v_name_ru from translations where entity_type='plant' and entity_id=p_plant_id and field='name' and locale='ru';
  select value into v_name_en from translations where entity_type='plant' and entity_id=p_plant_id and field='name' and locale='en';
  select value into v_desc_ru from translations where entity_type='plant' and entity_id=p_plant_id and field='description' and locale='ru';
  select value into v_desc_en from translations where entity_type='plant' and entity_id=p_plant_id and field='description' and locale='en';

  update plants set search_vector =
    setweight(to_tsvector('simple', coalesce(v_name_ru,'') || ' ' || coalesce(v_name_en,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_latin,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_desc_ru,'') || ' ' || coalesce(v_desc_en,'')), 'B')
  where id = p_plant_id;
end;
$$ language plpgsql;

create or replace function trg_plants_search_vector_self() returns trigger as $$
begin
  perform plants_refresh_search_vector(new.id);
  return null; -- AFTER trigger, возврат значения не используется
end;
$$ language plpgsql;

create trigger trg_plants_search_vector_on_plant
  after insert or update of latin_name on plants
  for each row execute function trg_plants_search_vector_self();

create or replace function trg_plants_search_vector_from_translation() returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    if old.entity_type = 'plant' and old.field in ('name','description') then
      perform plants_refresh_search_vector(old.entity_id);
    end if;
    return old;
  end if;
  if new.entity_type = 'plant' and new.field in ('name','description') then
    perform plants_refresh_search_vector(new.entity_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_translations_search_vector
  after insert or update or delete on translations
  for each row execute function trg_plants_search_vector_from_translation();

-- ==== RLS ====
alter table categories enable row level security;
alter table plants enable row level security;
alter table plant_images enable row level security;
alter table attributes enable row level security;
alter table plant_attribute_values enable row level security;
alter table availability enable row level security;
alter table prices enable row level security;
alter table translations enable row level security;

-- Публичное чтение — каталог должен быть виден без авторизации (SEO, Этап 9).
-- Запись пока не разрешена никому (владелец/RLS для поставщика добавляется в 0002
-- вместе с таблицей companies/users, от которой зависит company_id-проверка).
create policy "public_read_categories" on categories for select using (true);
create policy "public_read_active_plants" on plants for select using (status = 'active');
create policy "public_read_plant_images" on plant_images for select using (true);
create policy "public_read_attributes" on attributes for select using (true);
create policy "public_read_attribute_values" on plant_attribute_values for select using (true);
create policy "public_read_availability" on availability for select using (true);
create policy "public_read_prices" on prices for select using (true);
create policy "public_read_translations" on translations for select using (true);
