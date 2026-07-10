# Tamga Green — каркас проекта

Собрано по 9 документам + 2 активам (Phase 0-1 из `Tamga_Green_Build_Prompt.md`,
см. `docs/spec/`). Статус по фазам — `TODO.md`.

## Что сделано в Phase 1

- Next.js App Router + TypeScript + Tailwind (токены из `Tamga_Green_Design_Tokens.md`
  перенесены в `tailwind.config.ts` 1:1) + next-intl (`en`/`ru`).
- 4 миграции в `supabase/migrations/`:
  - `0001_init_catalog.sql` — каталог (categories/plants/plant_images/attributes/
    plant_attribute_values/availability/prices/translations) + полнотекстовый поиск.
  - `0002_transactional.sql` — companies/users/orders/carts/сообщения/AI-чат/
    requests/settings + все владельческие RLS-политики каталога.
  - `0003_content.sql` — landscape_solutions/projects/blog/faq/plant_compatibility.
  - `0004_audit.sql` — audit_log/price_change_log (Admin Panel §9).
- `supabase/seed.sql` — сгенерирован скриптом `scripts/generate-seed.mjs` из
  `supabase/seed-data/plants-catalog.json` (реальный прайс питомника «Дебский»,
  165 позиций, компания-поставщик заведена как первая верифицированная).
- **Все 40 таблиц** имеют `enable row level security` + хотя бы одну политику —
  проверено программно (см. TODO.md, Phase 1 отчёт).

## Важно: чем эта сессия проверяла миграции

В этой облачной среде нет Docker-демона (`docker ps` не может достучаться до
`/var/run/docker.sock`), поэтому `supabase start` здесь не запускался и не мог быть
запущен. Вместо этого миграции были провалидированы против нативного Postgres 16
(установлен в системе) со stub-схемой `auth.users` — это подтверждает, что весь SQL
синтаксически и логически корректен (включая RLS-изоляцию между двумя тестовыми
поставщиками — см. TODO.md), но **не проверяет** реальные Supabase-специфичные вещи
(Auth JWT claims, Storage, Realtime, Edge Functions) — это должно быть проверено на
вашей машине с Docker при первом `supabase start`.

`npm install`, `npm run build`, `npm run typecheck`, `npm run lint` — всё
запускалось по-настоящему в этой сессии и проходит чисто (см. ниже).

## Что нужно установить (у вас)

1. [Node.js](https://nodejs.org) 20+
2. [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`
3. Docker (нужен Supabase CLI для локального Postgres/Auth/Storage/Realtime)

## Запуск

```bash
npm install

supabase init      # если ещё не инициализировано
supabase start

# Supabase CLI выведет NEXT_PUBLIC_SUPABASE_URL и anon key —
cp .env.example .env.local
# вставьте туда значения из вывода supabase start

supabase db reset
# применяет supabase/migrations/*.sql по порядку, затем supabase/seed.sql

npm run dev
```

Откройте `http://localhost:3000/ru/catalog/khvoynye` — категория «Хвойные»
(77 позиций: можжевельники, туи, ели, сосны, тис, лиственница).

Если меняете `supabase/seed-data/plants-catalog.json` — перегенерируйте seed:

```bash
npm run generate-seed
```

## Проверка

```bash
npm run build       # ✓ проходит без ошибок (проверено в этой сессии)
npm run typecheck    # ✓ чисто
npm run lint         # ✓ чисто
```

## Структура

См. `docs/spec/Tamga_Green_System_Architecture.md`, раздел 2 — реализован пока не
весь каталог, а слайс: каталог по категориям + переводы + цены + остатки + вся
транзакционная/контентная схема БД. Остальное — по `TODO.md`.

Оригинальные 9 документов + 2 актива, из которых собран проект, лежат в `docs/spec/`
и `supabase/seed-data/` / `reference/` — источник истины для всех решений в коде.
