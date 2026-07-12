# Tamga Green

B2B-маркетплейс для питомников, садовых центров и ландшафтных компаний.
Собрано по 9 документам + 2 активам (`Tamga_Green_Build_Prompt.md`, см.
`docs/spec/`). Полная история по фазам и весь backlog — `TODO.md`.

## Стек

Next.js (App Router) + TypeScript + Tailwind + next-intl (`en`/`ru`) +
Supabase (Postgres + Auth + Storage + Realtime).

## Продакшн-деплой (Supabase + Vercel)

Занимает ~20-30 минут, без программирования — оба сервиса бесплатны на старте.

### 1. Supabase (база данных)

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) (можно через GitHub).
2. **New Project** — задайте название, пароль базы данных (сохраните отдельно)
   и регион.
3. В **Project Settings → API** скопируйте `Project URL` и `anon public` key —
   понадобятся на шаге 2.
4. В **SQL Editor** выполните по очереди все файлы из `supabase/migrations/`
   строго по номеру (`0001_init_catalog.sql` → `0010_realtime_prices.sql`).
5. Там же выполните `supabase/seed.sql` — это загрузит демо-каталог: 165
   реальных позиций питомника «Дебский» (Кыргызстан, цены в KGS).
6. В **Authentication → Hooks** убедитесь, что `custom_access_token_hook`
   включён (объявлен в `supabase/config.toml`, но на хостинге иногда нужно
   подтвердить вручную) — без него JWT не будет нести `role`/`company_id`,
   и RLS-политики, зависящие от них, не будут срабатывать как надо.

### 2. Vercel (сайт)

1. Зарегистрируйтесь на [vercel.com](https://vercel.com) через тот же GitHub.
2. **Add New Project** → выберите репозиторий — Vercel сам распознает Next.js.
3. В **Environment Variables** добавьте значения из шага 1.3:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Через пару минут сайт будет доступен по ссылке вида
   `<project>.vercel.app`. Дальнейшие пуши в подключённую ветку деплоятся
   автоматически.

Опционально (иначе соответствующие AI-функции корректно деградируют без них,
см. `TODO.md`):
- `VOYAGE_API_KEY` — эмбеддинги для AI-поиска.
- `ANTHROPIC_API_KEY` — реальная генерация AI-описаний вместо шаблона.

## Локальная разработка

Нужны: [Node.js](https://nodejs.org) 20+, [Supabase CLI](https://supabase.com/docs/guides/cli)
(`npm install -g supabase`), Docker (нужен CLI для локального Postgres/Auth/Storage/Realtime).

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

Откройте `http://localhost:3000/ru/catalog/khvoynye` — категория «Хвойные».

Если меняете `supabase/seed-data/plants-catalog.json` — перегенерируйте seed:

```bash
npm run generate-seed
```

## Проверка

```bash
npm run build
npm run typecheck
npm run lint
```

Все три команды регулярно прогонялись в ходе сборки и проходят чисто — см.
отчёты по фазам в `TODO.md`.

## Важно: как эта сборка проверялась без Docker

Среда, в которой собирался проект, не имеет Docker-демона, поэтому
`supabase start` в ней запустить было нельзя. Миграции вместо этого
проверялись против нативного Postgres 16 со stub-схемой `auth`/`storage` —
это подтверждает корректность SQL и RLS-изоляции (включая живые тесты между
несколькими смоделированными аккаунтами, см. `TODO.md`), но не проверяет
Supabase-специфичные вещи (реальные Auth JWT из живого проекта, Storage,
Realtime WebSocket-обмен между вкладками, Edge Functions) — это стоит вручную
пройти на вашем задеплоенном проекте после первого запуска.

## Структура

См. `docs/spec/Tamga_Green_System_Architecture.md`, раздел 2. Полная история
по фазам (что сделано, что отклонилось от документов и почему, весь backlog)
— `TODO.md`.

Оригинальные 9 документов + 2 актива, из которых собран проект, лежат в
`docs/spec/` и `supabase/seed-data/` / `reference/` — источник истины для
всех решений в коде.
