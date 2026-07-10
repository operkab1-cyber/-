-- Migration: 0003_content.sql
-- Источник: Tamga_Green_Database_Design.md, раздел 5 (контент и портфолио) +
-- Tamga_Green_Plant_Catalog.md, раздел 8 (совместимые растения — расширение схемы).
-- Названия/описания этих сущностей — через translations (0001), кроме plant_compatibility
-- (короткое служебное поле reason, не мультиязычное на MVP).

-- ==== ГОТОВЫЕ ЛАНДШАФТНЫЕ РЕШЕНИЯ ====
create table landscape_solutions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  icon text,
  cover_image text,
  price_from numeric(10,2),
  currency text default 'EUR',
  status text not null default 'active' check (status in ('active','archived')),
  sort_order int default 0
);

create table solution_plants (
  solution_id uuid references landscape_solutions(id) on delete cascade,
  plant_id uuid references plants(id) on delete cascade,
  qty_per_unit numeric,
  primary key (solution_id, plant_id)
);

-- ==== ПРОЕКТЫ (портфолио) ====
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  request_id uuid references requests(id),
  slug text unique not null,
  location text,
  area_sqm numeric,
  completed_at date,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz default now()
);

create table project_solutions (
  project_id uuid references projects(id) on delete cascade,
  solution_id uuid references landscape_solutions(id) on delete cascade,
  primary key (project_id, solution_id)
);

-- ==== ГАЛЕРЕЯ (полиморфная) ====
create table gallery_images (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project','landscape_solution','blog_post')),
  entity_id uuid not null,
  file_path text not null,
  caption text,
  position int default 0
);

-- ==== БЛОГ ====
create table blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references blog_categories(id),
  author_id uuid references users(id),
  slug text unique not null,
  cover_image text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz default now()
);

-- ==== FAQ ====
create table faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  sort_order int default 0
);

create table faq_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references faq_categories(id),
  sort_order int default 0
);

-- ==== СОВМЕСТИМЫЕ РАСТЕНИЯ (Plant Catalog §8) ====
create table plant_compatibility (
  id uuid primary key default gen_random_uuid(),
  plant_id_a uuid references plants(id) on delete cascade,
  plant_id_b uuid references plants(id) on delete cascade,
  relation text not null check (relation in ('companion','incompatible')),
  reason text,
  source text default 'expert' check (source in ('expert','ai_suggested')),
  check (plant_id_a <> plant_id_b)
);
create unique index idx_plant_compat_pair
  on plant_compatibility(least(plant_id_a, plant_id_b), greatest(plant_id_a, plant_id_b));

-- ==== ИНДЕКСЫ ====
create index idx_gallery_entity on gallery_images(entity_type, entity_id);
create index idx_blog_posts_status on blog_posts(status, published_at desc);
create index idx_faq_items_category on faq_items(category_id, sort_order);
create index idx_projects_company on projects(company_id);
create index idx_solution_plants_solution on solution_plants(solution_id);

-- ==== RLS — каждая таблица, без исключений ====
alter table landscape_solutions enable row level security;
alter table solution_plants enable row level security;
alter table projects enable row level security;
alter table project_solutions enable row level security;
alter table gallery_images enable row level security;
alter table blog_categories enable row level security;
alter table blog_posts enable row level security;
alter table faq_categories enable row level security;
alter table faq_items enable row level security;
alter table plant_compatibility enable row level security;

-- Контентный слой — публичное чтение опубликованного, запись — только администратор
-- (это редакционный/маркетинговый контент платформы, а не каталог поставщика).
create policy "public_read_active_solutions" on landscape_solutions for select
  using (status = 'active');
create policy "admin_all_solutions" on landscape_solutions for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_solution_plants" on solution_plants for select using (true);
create policy "admin_all_solution_plants" on solution_plants for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_published_projects" on projects for select
  using (status = 'published');
create policy "owner_manage_own_projects" on projects for all
  using (company_id = auth_company_id()) with check (company_id = auth_company_id());
create policy "admin_all_projects" on projects for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_project_solutions" on project_solutions for select using (true);
create policy "admin_all_project_solutions" on project_solutions for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_gallery_images" on gallery_images for select using (true);
create policy "admin_all_gallery_images" on gallery_images for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_blog_categories" on blog_categories for select using (true);
create policy "admin_all_blog_categories" on blog_categories for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_published_blog_posts" on blog_posts for select
  using (status = 'published');
create policy "author_manage_own_blog_posts" on blog_posts for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "admin_all_blog_posts" on blog_posts for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_faq_categories" on faq_categories for select using (true);
create policy "admin_all_faq_categories" on faq_categories for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "public_read_faq_items" on faq_items for select using (true);
create policy "admin_all_faq_items" on faq_items for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- plant_compatibility: публично видны записи с source='expert' (проверенные),
-- ai_suggested — видны только владельцу растения и админу до подтверждения
-- (human-in-the-loop, AI Architecture §13.4).
create policy "public_read_expert_compatibility" on plant_compatibility for select
  using (source = 'expert');
create policy "owner_read_ai_suggested_compatibility" on plant_compatibility for select
  using (
    source = 'ai_suggested'
    and (plant_id_a in (select id from plants where company_id = auth_company_id())
      or plant_id_b in (select id from plants where company_id = auth_company_id()))
  );
create policy "admin_all_plant_compatibility" on plant_compatibility for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
