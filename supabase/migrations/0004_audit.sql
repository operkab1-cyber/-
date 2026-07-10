-- Migration: 0004_audit.sql
-- Источник: Tamga_Green_Admin_Panel.md, раздел 9 (журнал действий) и раздел 4.2
-- (откат массового изменения цен в течение 24 часов).

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,             -- 'bulk_price_update' | 'bulk_stock_update' | 'excel_import' | ...
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);

-- Хранит предыдущие значения prices для отката массового изменения в течение 24ч
-- (Admin Panel §4.2: "откат хранит предыдущие значения prices во временной таблице").
create table price_change_log (
  id uuid primary key default gen_random_uuid(),
  audit_log_id uuid references audit_log(id) on delete cascade,
  plant_id uuid references plants(id) on delete cascade,
  previous_price numeric(10,2) not null,
  previous_min_qty numeric not null,
  previous_currency text not null,
  created_at timestamptz default now()
);

create index idx_audit_log_actor on audit_log(actor_id, created_at desc);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);
create index idx_price_change_log_plant on price_change_log(plant_id);

alter table audit_log enable row level security;
alter table price_change_log enable row level security;

-- audit_log: автор видит свои записи, админ видит всё (агрегированный журнал
-- по всем поставщикам — Admin Panel §9, "не содержимое, а факт и масштаб операции"
-- обеспечивается на уровне UI/запроса, не RLS — здесь по факту тот же select).
create policy "self_read_audit_log" on audit_log for select using (actor_id = auth.uid());
create policy "admin_read_audit_log" on audit_log for select
  using (auth_role() = 'admin');
create policy "self_insert_audit_log" on audit_log for insert with check (actor_id = auth.uid());

-- price_change_log: виден владельцу изменённого товара (для отката) + админу.
create policy "owner_read_price_change_log" on price_change_log for select
  using (plant_id in (select id from plants where company_id = auth_company_id()));
create policy "admin_all_price_change_log" on price_change_log for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy "owner_insert_price_change_log" on price_change_log for insert
  with check (plant_id in (select id from plants where company_id = auth_company_id()));
