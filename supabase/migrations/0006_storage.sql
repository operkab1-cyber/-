-- Migration: 0006_storage.sql
-- Источник: Tamga_Green_System_Architecture.md §6.3 (таблица бакетов) + §12.2
-- ("отдельный приватный bucket, доступ только владельцу и администратору, ссылки —
-- только подписанные, TTL 5 минут" — TTL обеспечивается на уровне кода, выдающего
-- signed URL, здесь — только кто может читать/писать объект).
--
-- Соглашение о путях: первый сегмент пути — владеющая сущность, чтобы RLS-политика
-- могла проверить владение через storage.foldername(name)[1] без доп. таблиц:
--   product-images/{company_id}/{plant_id}/{file}
--   avatars/{company_id}/{file}
--   verification-docs/{company_id}/{file}
--   order-attachments/{order_id}/{file}

insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('avatars', 'avatars', true),
  ('verification-docs', 'verification-docs', false),
  ('order-attachments', 'order-attachments', false)
on conflict (id) do nothing;

-- ==== product-images: публичное чтение, пишет владелец товара (по company_id в пути) ====
create policy "public_read_product_images_bucket" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "owner_write_product_images_bucket" on storage.objects for insert
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "owner_update_product_images_bucket" on storage.objects for update
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "owner_delete_product_images_bucket" on storage.objects for delete
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth_company_id()::text);

-- ==== avatars: публичное чтение, пишет владеющая компания ====
create policy "public_read_avatars_bucket" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "owner_write_avatars_bucket" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "owner_update_avatars_bucket" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "owner_delete_avatars_bucket" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth_company_id()::text);

-- ==== verification-docs: приватный, владелец компании + администратор ====
create policy "owner_or_admin_read_verification_docs_bucket" on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_role() = 'admin')
  );
create policy "owner_write_verification_docs_bucket" on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "owner_delete_verification_docs_bucket" on storage.objects for delete
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_role() = 'admin')
  );

-- ==== order-attachments: приватный, участники заказа (первый сегмент пути = order_id) + админ ====
create policy "party_read_order_attachments_bucket" on storage.objects for select
  using (
    bucket_id = 'order-attachments'
    and (
      auth_role() = 'admin'
      or (storage.foldername(name))[1]::uuid in (
        select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()
      )
    )
  );
create policy "party_write_order_attachments_bucket" on storage.objects for insert
  with check (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1]::uuid in (
      select id from orders where buyer_company_id = auth_company_id() or supplier_company_id = auth_company_id()
    )
  );
