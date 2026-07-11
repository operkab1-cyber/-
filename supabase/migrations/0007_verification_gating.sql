-- Migration: 0007_verification_gating.sql
-- Найдено при ревизии Phase 2 (расходилось с собственным примером документов):
--
-- 1. `public_read_active_plants` (0001) не проверяла, что владеющая компания
--    approved — в отличие от точного примера в System Architecture §7.4
--    ("status = 'active' and exists (select 1 from companies where ... approved)").
--    С единственным заведомо approved поставщиком (seed) баг был не виден, но при
--    появлении второго pending-поставщика с status='active' его товары были бы
--    видны публично.
-- 2. Ни одна write-политика не проверяла verification_status='approved' — UX Bible
--    §4.3 прямо говорит: "пока не подтверждено... недоступны заказ/загрузка
--    товаров". RLS (последний рубеж, §12.1) должна гарантировать это сама, а не
--    полагаться на то, что Phase 4/5 ещё не построили соответствующий UI.

drop policy "public_read_active_plants" on plants;
create policy "public_read_active_plants" on plants for select
  using (
    status = 'active'
    and exists (
      select 1 from companies
      where companies.id = plants.company_id
      and companies.verification_status = 'approved'
    )
  );

drop policy "supplier_manage_own_plants" on plants;
create policy "supplier_manage_own_plants" on plants for all
  using (
    company_id = auth_company_id()
    and exists (select 1 from companies where id = auth_company_id() and verification_status = 'approved')
  )
  with check (
    company_id = auth_company_id()
    and exists (select 1 from companies where id = auth_company_id() and verification_status = 'approved')
  );

drop policy "buyer_insert_orders" on orders;
create policy "buyer_insert_orders" on orders for insert
  with check (
    buyer_company_id = auth_company_id()
    and exists (select 1 from companies where id = auth_company_id() and verification_status = 'approved')
  );
