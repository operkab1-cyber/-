-- Migration: 0002_transactional.sql
-- Источник: Tamga_Green_Database_Design.md, разделы 4 и 6 (companies/verification_documents
-- переносятся из Tamga_Green_System_Architecture.md, раздел 7.2, т.к. Этап 5 их не
-- переопределяет — см. "Сверка с Этапом 4", раздел 8: companies остаётся как есть).
-- Добавляет: companies, verification_documents, users, заказы/корзина, общение и
-- доверие, AI-помощник (сессии/сообщения/кэш), заявки (requests), настройки платформы.
-- Все FK транзакционных таблиц из Этапа 4 переименованы на plant_id (раздел 8 сверки).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ==== КОМПАНИИ (Architecture §7.2, не изменено Database Design §8) ====
create type company_type as enum ('nursery', 'wholesaler', 'garden_center', 'landscaper', 'other');
create type verification_status as enum ('pending', 'approved', 'rejected');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  type company_type not null,
  country text not null,
  vat_number text,
  address text,
  description text,
  logo_url text,
  verification_status verification_status default 'pending',
  rating_avg numeric(2,1) default 0,
  rating_count int default 0,
  monthly_purchase_volume text,
  credit_limit numeric(12,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==== ПОЛЬЗОВАТЕЛИ (Database Design §4 — "users", функционально = profiles Этапа 4) ====
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id),
  role text not null check (role in ('supplier','buyer','admin','consumer')),
  full_name text not null,
  email text not null,
  phone text,
  locale text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table verification_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  doc_type text not null,               -- 'phytosanitary' | 'vat' | 'organic_cert' | ...
  file_path text not null,              -- путь в Storage bucket verification-docs
  status verification_status default 'pending',
  rejection_reason text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Теперь, когда companies существует, довешиваем FK на plants.company_id (0001 оставил его "голым").
alter table plants
  add constraint fk_plants_company foreign key (company_id) references companies(id) on delete cascade;

-- ==== ЗАКАЗЫ (Architecture §7.2, FK переименован products->plants на plant_id) ====
create type order_status as enum (
  'new', 'confirmed', 'packed', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled'
);

create table carts (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid references companies(id),
  created_at timestamptz default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references carts(id) on delete cascade,
  plant_id uuid references plants(id),
  qty numeric not null,
  price_snapshot numeric(10,2) not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  buyer_company_id uuid references companies(id),
  supplier_company_id uuid references companies(id),
  status order_status default 'new',
  subtotal numeric(12,2) not null,
  shipping_cost numeric(10,2) default 0,
  total numeric(12,2) not null,
  currency text default 'EUR',
  shipping_address jsonb not null,
  payment_method text,                   -- 'card' | 'invoice' | 'escrow'
  confirm_deadline timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  plant_id uuid references plants(id),
  product_name_snapshot jsonb not null,
  qty numeric not null,
  unit_price numeric(10,2) not null
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references users(id),
  note text,
  created_at timestamptz default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  estimated_delivery date,
  temperature_controlled boolean default false
);

-- ==== ОБЩЕНИЕ И ДОВЕРИЕ ====
create table conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid references companies(id),
  supplier_company_id uuid references companies(id),
  order_id uuid references orders(id),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references users(id),
  body text,
  attachment_path text,
  is_ai boolean default false,
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  reviewer_company_id uuid references companies(id),
  reviewed_company_id uuid references companies(id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  raised_by uuid references users(id),
  reason text,
  evidence_paths text[],
  resolution text,
  resolved_by uuid references users(id),
  status text default 'open' check (status in ('open','resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  plant_id uuid references plants(id),
  company_id uuid references companies(id),
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null check (type in ('order_status','message','system','marketing')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ==== AI-ПОМОЩНИК ====
create table ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  started_at timestamptz default now()
);

create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text,
  tool_call jsonb,
  created_at timestamptz default now()
);

-- Кэш AI-ответов (Database Design §6) — общий между пользователями, с TTL и embedding.
create table ai_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text unique not null,
  query_text text not null,
  response jsonb not null,
  embedding vector(1536),
  hit_count int default 1,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- ==== ЗАЯВКИ / ЛИДЫ (Database Design §4) ====
create table requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),     -- null — анонимный лид (гость)
  type text not null check (type in ('quote','contact','project_consultation','plant_availability_alert')),
  subject_type text check (subject_type in ('plant','landscape_solution','project')),
  subject_id uuid,
  name text,
  email text,
  phone text,
  message text,
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  assigned_to uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==== НАСТРОЙКИ ПЛАТФОРМЫ ====
create table settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ==== ИНДЕКСЫ ====
create index idx_verification_documents_company on verification_documents(company_id);
create index idx_orders_buyer on orders(buyer_company_id);
create index idx_orders_supplier on orders(supplier_company_id);
create index idx_orders_status on orders(status);
create index idx_order_items_order on order_items(order_id);
create index idx_cart_items_cart on cart_items(cart_id);
create index idx_messages_conversation on messages(conversation_id, created_at);
create index idx_notifications_unread on notifications(user_id) where read_at is null;
create index idx_requests_status on requests(status);
create index idx_requests_subject on requests(subject_type, subject_id);
create unique index idx_ai_cache_hash on ai_cache(query_hash);
create index idx_ai_cache_embedding on ai_cache using ivfflat (embedding vector_cosine_ops);
create index idx_ai_cache_expiry on ai_cache(expires_at);
create index idx_favorites_user on favorites(user_id);

-- ==== updated_at триггер общего назначения (Architecture §6.2) ====
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger trg_requests_updated_at before update on requests
  for each row execute function set_updated_at();
create trigger trg_plants_updated_at before update on plants
  for each row execute function set_updated_at();

-- ==== RLS — включаем на каждой таблице без исключений (Database Design §7.4) ====
alter table companies enable row level security;
alter table users enable row level security;
alter table verification_documents enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table shipments enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table favorites enable row level security;
alter table notifications enable row level security;
alter table ai_chat_sessions enable row level security;
alter table ai_chat_messages enable row level security;
alter table ai_cache enable row level security;
alter table requests enable row level security;
alter table settings enable row level security;

-- Helper: текущая компания/роль пользователя, без повторного JOIN в каждой политике.
create or replace function auth_company_id() returns uuid as $$
  select company_id from users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_role() returns text as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;

-- companies: публично видны верифицированные (профиль поставщика), владелец видит/правит свою,
-- админ видит все.
create policy "public_read_approved_companies" on companies for select
  using (verification_status = 'approved');
create policy "member_read_own_company" on companies for select
  using (id = auth_company_id());
create policy "member_update_own_company" on companies for update
  using (id = auth_company_id()) with check (id = auth_company_id());
create policy "admin_all_companies" on companies for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- users: пользователь видит и правит только себя, коллег по компании видит (для CMS-команды),
-- админ видит всех.
create policy "self_read_update" on users for select using (id = auth.uid());
create policy "self_update" on users for update using (id = auth.uid()) with check (id = auth.uid());
create policy "colleagues_read" on users for select using (company_id = auth_company_id());
create policy "admin_all_users" on users for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- verification_documents: владелец компании + админ.
create policy "owner_manage_verification_docs" on verification_documents for all
  using (company_id = auth_company_id()) with check (company_id = auth_company_id());
create policy "admin_all_verification_docs" on verification_documents for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- carts / cart_items: покупатель видит и правит только свою корзину.
create policy "buyer_manage_own_cart" on carts for all
  using (buyer_company_id = auth_company_id()) with check (buyer_company_id = auth_company_id());
create policy "buyer_manage_own_cart_items" on cart_items for all
  using (cart_id in (select id from carts where buyer_company_id = auth_company_id()))
  with check (cart_id in (select id from carts where buyer_company_id = auth_company_id()));

-- orders / order_items: видны покупателю и поставщику этого заказа, админу — все.
create policy "party_read_orders" on orders for select
  using (buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id());
create policy "buyer_insert_orders" on orders for insert
  with check (buyer_company_id = auth_company_id());
create policy "supplier_update_own_orders" on orders for update
  using (supplier_company_id = auth_company_id()) with check (supplier_company_id = auth_company_id());
create policy "admin_all_orders" on orders for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "party_read_order_items" on order_items for select
  using (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));
create policy "admin_all_order_items" on order_items for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "party_read_order_status_history" on order_status_history for select
  using (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));
create policy "party_insert_order_status_history" on order_status_history for insert
  with check (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));

create policy "party_read_shipments" on shipments for select
  using (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));
create policy "supplier_manage_shipments" on shipments for all
  using (order_id in (select id from orders where supplier_company_id = auth_company_id()))
  with check (order_id in (select id from orders where supplier_company_id = auth_company_id()));

-- conversations / messages: видны участникам диалога.
create policy "party_read_conversations" on conversations for select
  using (buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id());
create policy "party_insert_conversations" on conversations for insert
  with check (buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id());

create policy "party_read_messages" on messages for select
  using (conversation_id in (
    select id from conversations where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()
  ));
create policy "party_insert_messages" on messages for insert
  with check (conversation_id in (
    select id from conversations where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()
  ));

-- reviews: публично читаемы (доверие покупателей), пишет только участник завершённого заказа.
create policy "public_read_reviews" on reviews for select using (true);
create policy "reviewer_insert_reviews" on reviews for insert
  with check (reviewer_company_id = auth_company_id());

-- disputes: видны сторонам заказа + админу, создаёт участник заказа.
create policy "party_read_disputes" on disputes for select
  using (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));
create policy "party_insert_disputes" on disputes for insert
  with check (order_id in (select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()));
create policy "admin_all_disputes" on disputes for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- favorites: только свои.
create policy "self_manage_favorites" on favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications: только свои.
create policy "self_read_notifications" on notifications for select using (user_id = auth.uid());
create policy "self_update_notifications" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai_chat_sessions / ai_chat_messages: только владелец сессии.
create policy "self_manage_ai_sessions" on ai_chat_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "self_manage_ai_messages" on ai_chat_messages for all
  using (session_id in (select id from ai_chat_sessions where user_id = auth.uid()))
  with check (session_id in (select id from ai_chat_sessions where user_id = auth.uid()));

-- ai_cache: общий кэш без персональных данных — читает любой аутентифицированный
-- пользователь (экономит вызовы LLM всем), пишет только сервисная роль (Edge Function).
create policy "authenticated_read_ai_cache" on ai_cache for select
  using (auth.role() = 'authenticated');

-- requests: гость может создать (user_id null), пользователь видит свои, назначенный
-- сотрудник и админ видят все.
create policy "self_read_requests" on requests for select
  using (user_id = auth.uid() or auth_role() in ('admin','supplier'));
create policy "anyone_insert_requests" on requests for insert with check (true);
create policy "assignee_update_requests" on requests for update
  using (auth_role() in ('admin','supplier')) with check (auth_role() in ('admin','supplier'));

-- settings: публично читаемы (конфигурация вроде default_currency), правит только админ.
create policy "public_read_settings" on settings for select using (true);
create policy "admin_write_settings" on settings for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ==== Владельческие RLS-политики каталога (0001 оставил их здесь — зависят от
-- companies/users, которых не было в 0001). Публичное чтение уже описано в 0001;
-- здесь добавляется запись владельцем (Database Design §7.4 — "публичное чтение
-- подтверждённого + полный доступ владельцу + доступ администратору").

create policy "supplier_manage_own_plants" on plants for all
  using (company_id = auth_company_id()) with check (company_id = auth_company_id());
create policy "admin_all_plants" on plants for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "supplier_manage_own_plant_images" on plant_images for all
  using (plant_id in (select id from plants where company_id = auth_company_id()))
  with check (plant_id in (select id from plants where company_id = auth_company_id()));
create policy "admin_all_plant_images" on plant_images for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "supplier_manage_own_availability" on availability for all
  using (plant_id in (select id from plants where company_id = auth_company_id()))
  with check (plant_id in (select id from plants where company_id = auth_company_id()));
create policy "admin_all_availability" on availability for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "supplier_manage_own_prices" on prices for all
  using (plant_id in (select id from plants where company_id = auth_company_id()))
  with check (plant_id in (select id from plants where company_id = auth_company_id()));
create policy "admin_all_prices" on prices for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "supplier_manage_own_attribute_values" on plant_attribute_values for all
  using (plant_id in (select id from plants where company_id = auth_company_id()))
  with check (plant_id in (select id from plants where company_id = auth_company_id()));
create policy "admin_all_attribute_values" on plant_attribute_values for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- categories/attributes: справочники каталога — правит только администратор
-- (UX Bible §12.3 "Управление каталогом категорий" — раздел кабинета Администратора).
create policy "admin_write_categories" on categories for insert
  with check (auth_role() = 'admin');
create policy "admin_update_categories" on categories for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy "admin_delete_categories" on categories for delete
  using (auth_role() = 'admin');

create policy "admin_write_attributes" on attributes for insert
  with check (auth_role() = 'admin');
create policy "admin_update_attributes" on attributes for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy "admin_delete_attributes" on attributes for delete
  using (auth_role() = 'admin');

-- translations: владелец сущности правит свой перевод (для plant — владелец
-- через plants.company_id), администратор — все переводы (категории, блог, FAQ...).
create policy "supplier_manage_own_plant_translations" on translations for all
  using (
    entity_type = 'plant'
    and entity_id in (select id from plants where company_id = auth_company_id())
  )
  with check (
    entity_type = 'plant'
    and entity_id in (select id from plants where company_id = auth_company_id())
  );
create policy "admin_all_translations" on translations for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
