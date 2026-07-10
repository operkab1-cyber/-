# Tamga Green
## System Architecture
### Этап 4 — Архитектура платформы

**Версия документа:** 1.0
**Роль автора:** Senior Software Architect
**Опирается на:** PRD (Этап 1), UX Bible (Этап 2), Design System (Этап 3)
**Статус:** Черновик для технического ревью перед началом разработки

---

## Оглавление

1. Обзор архитектуры и стек
2. Структура проекта (Next.js)
3. Стратегия рендеринга и роутинг
4. React: паттерны компонентов и state
5. Tailwind: конфигурация под дизайн-токены
6. Supabase: Auth, Database, Storage, Realtime, Edge Functions
7. Структура базы данных
8. API-слой
9. Поиск
10. AI-помощник
11. Мультиязычность (i18n)
12. Безопасность
13. Производительность
14. Резервное копирование и disaster recovery
15. SEO
16. Инфраструктура, окружения, CI/CD
17. Итоговая диаграмма системы

---

## 1. Обзор архитектуры и стек

### 1.1 Технологический стек

| Слой | Технология | Обоснование |
|---|---|---|
| Frontend framework | **Next.js 15 (App Router)** | SSR/ISR для SEO публичного каталога, Server Components снижают JS на клиенте, встроенный роутинг API |
| UI-библиотека | **React 19** | Server Components + Actions, экосистема |
| Стилизация | **Tailwind CSS 4** | Прямое отображение токенов Design System (Этап 3) в конфиг, быстрая разработка компонентной библиотеки |
| Backend-as-a-Service | **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) | Единая точка для БД, авторизации, файлового хранилища и realtime-обновлений остатков/заказов без отдельного бэкенд-сервиса на старте |
| Полнотекстовый поиск | **Postgres `tsvector`/`pg_trgm`** на старте → **Meilisearch/Typesense** при росте каталога | Не плодить лишнюю инфраструктуру на MVP, но заложить точку миграции |
| AI-слой | **LLM API (Claude) + RAG над каталогом** через Supabase Edge Functions | Изолирует ключи и промпты от клиента, позволяет function calling к калькуляторам и БД |
| i18n | **next-intl** | Нативная интеграция с App Router, поддержка серверных компонентов |
| Хостинг frontend | **Vercel** | Нативная поддержка Next.js ISR/Edge, интеграция с превью-деплоями |
| Мониторинг | **Sentry** (ошибки) + **Vercel Analytics/Speed Insights** + **Supabase Logs** | Наблюдаемость на всех слоях |

### 1.2 Высокоуровневая схема

```
                         ┌───────────────────────┐
                         │        Vercel          │
                         │  Next.js App Router     │
                         │  (SSR / ISR / Edge)     │
                         └───────────┬────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              │                      │                       │
     ┌────────▼────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
     │  Supabase Auth    │   │  Supabase Postgres │   │  Supabase Storage  │
     │  (JWT, роли)       │   │  (RLS, данные)      │   │  (фото, документы) │
     └────────┬────────┘   └─────────┬─────────┘   └─────────┬─────────┘
              │                      │                       │
              │             ┌────────▼────────┐              │
              │             │  Supabase Realtime│              │
              │             │  (заказы, чаты)    │              │
              │             └────────────────────┘              │
              │                                                  │
     ┌────────▼──────────────────────────────────────────────────▼────────┐
     │                     Supabase Edge Functions                        │
     │   AI-помощник (RAG + function calling) · Поиск · Верификация       │
     │   Расчёт логистики · Webhooks платёжного провайдера                │
     └───────────────────────────────────────────────────────────────────┘
```

---

## 2. Структура проекта (Next.js)

```
tamga-green/
├── apps/
│   └── web/                          # основное Next.js приложение
│       ├── app/
│       │   ├── [locale]/             # мультиязычные маршруты (next-intl)
│       │   │   ├── (public)/         # публичная зона — SSR/ISR для SEO
│       │   │   │   ├── page.tsx                  # главная
│       │   │   │   ├── catalog/
│       │   │   │   │   ├── page.tsx              # список товаров
│       │   │   │   │   └── [productSlug]/page.tsx
│       │   │   │   ├── suppliers/[companySlug]/page.tsx
│       │   │   │   ├── how-it-works/page.tsx
│       │   │   │   └── blog/[slug]/page.tsx
│       │   │   ├── (auth)/
│       │   │   │   ├── login/page.tsx
│       │   │   │   ├── register/page.tsx
│       │   │   │   └── onboarding/[step]/page.tsx
│       │   │   ├── (supplier)/       # защищённая зона поставщика
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── products/page.tsx
│       │   │   │   ├── products/[id]/edit/page.tsx
│       │   │   │   ├── orders/page.tsx
│       │   │   │   └── analytics/page.tsx
│       │   │   ├── (buyer)/          # защищённая зона покупателя
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── cart/page.tsx
│       │   │   │   ├── checkout/page.tsx
│       │   │   │   ├── orders/page.tsx
│       │   │   │   └── calculators/page.tsx
│       │   │   └── (admin)/
│       │   │       ├── verification/page.tsx
│       │   │       └── disputes/page.tsx
│       │   ├── api/                  # Route Handlers (webhooks, интеграции)
│       │   │   ├── webhooks/payment/route.ts
│       │   │   ├── webhooks/shipping/route.ts
│       │   │   └── sitemap.xml/route.ts
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                   # примитивы дизайн-системы (Button, Card, Badge…)
│       │   ├── catalog/              # ProductCard, FilterPanel, SearchBar
│       │   ├── cart/                 # CartDrawer, VendorGroup
│       │   ├── ai-assistant/         # ChatWidget, MessageBubble
│       │   └── forms/                # RHF+Zod формы (регистрация, товар, чекаут)
│       ├── lib/
│       │   ├── supabase/             # client.ts (browser), server.ts, admin.ts
│       │   ├── actions/              # Server Actions (mutations)
│       │   ├── queries/              # серверные data-fetching функции
│       │   ├── validation/           # Zod-схемы
│       │   └── ai/                   # промпты, RAG-хелперы, function-calling схемы
│       ├── styles/globals.css        # Tailwind + design tokens
│       ├── messages/                 # ru.json, en.json, de.json, pl.json…
│       ├── middleware.ts             # locale + auth guard
│       ├── tailwind.config.ts
│       └── next.config.ts
├── packages/
│   ├── database-types/               # автогенерируемые типы Supabase (supabase gen types)
│   └── ui-tokens/                    # design tokens из Этапа 3 как единый источник правды
├── supabase/
│   ├── migrations/                   # SQL-миграции (версионируемая схема БД)
│   ├── functions/                    # Edge Functions (ai-assistant, search, verify-document)
│   └── seed.sql
└── turbo.json                        # monorepo (Turborepo), если потребуется отдельный воркер/админка
```

**Логика разделения:** `(public)`, `(supplier)`, `(buyer)`, `(admin)` — Next.js route groups, каждая со своим layout и middleware-проверкой роли, но общим набором UI-компонентов из `components/ui`.

---

## 3. Стратегия рендеринга и роутинг

| Тип страницы | Стратегия | Обоснование |
|---|---|---|
| Главная, «Как это работает», блог | **SSG + ISR** (ревалидация раз в час) | Максимальный SEO и скорость, контент меняется редко |
| Публичный каталог и карточка товара | **ISR** (ревалидация 60–120 сек) + on-demand revalidation при изменении остатка/цены поставщиком | Баланс SEO и актуальности живых данных |
| Кабинеты (dashboard, заказы, каталог поставщика) | **SSR/CSR-гибрид**: серверная первая загрузка через Server Components + клиентские интерактивные island’ы (фильтры, корзина) | Персонализированные данные, не подлежат кэшированию |
| AI-чат, realtime-уведомления | **CSR + Supabase Realtime (WebSocket)** | Требуют постоянного соединения |
| Чекаут | **SSR без кэша** | Данные о цене/остатке должны быть свежими на 100% |

**Роутинг:** App Router с `[locale]` в корне; middleware определяет локаль по заголовку `Accept-Language`/cookie и роль пользователя по JWT из Supabase, редиректит неавторизованных из защищённых групп на `/login`.

**On-demand revalidation:** при изменении остатка/цены поставщиком Server Action вызывает `revalidatePath`/`revalidateTag` для соответствующей карточки товара — совмещает ISR-производительность с точечной актуальностью.

---

## 4. React: паттерны компонентов и state

- **Server Components по умолчанию** — вся статика и данные каталога рендерятся на сервере; `"use client"` только там, где нужна интерактивность (фильтры, корзина, чат, формы).
- **Server Actions** для всех мутаций (добавить товар, оформить заказ, отправить сообщение) вместо отдельного REST-слоя — снижает количество ручных API-роутов.
- **Локальный UI-state** — React `useState`/`useReducer` для форм и виджетов.
- **Серверный/кэшируемый state** — **TanStack Query** поверх Supabase-клиента на клиентских островках (корзина, realtime-статусы заказов) для дедупликации запросов и оптимистичных обновлений (см. UX Bible, «оптимистичный UI»).
- **Глобальный лёгкий state** (открыт ли AI-чат, текущая локаль, тема) — React Context, без тяжёлых стейт-менеджеров.
- **Формы** — React Hook Form + Zod-схемы, переиспользуемые между клиентской валидацией и серверной проверкой в Server Action (одна схема — два места использования).

---

## 5. Tailwind: конфигурация под дизайн-токены

Токены из Этапа 3 переносятся в `tailwind.config.ts` один в один, чтобы дизайн-система оставалась единственным источником правды:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canopy: "#1F3D2B",
        sap: { DEFAULT: "#3E7D44", hover: "#2F6435", active: "#245029" },
        sprout: { DEFAULT: "#7FB069", bg: "#E7F0DF" },
        stamp: { DEFAULT: "#B8873A", dark: "#8C6526", bg: "#F3E8D2" },
        paper: { DEFAULT: "#F5F3E8", deep: "#ECE9DA" },
        ink: { DEFAULT: "#1E2119", muted: "#5B6259" },
        border: "#D9D5C3",
        error: { DEFAULT: "#A3402D", bg: "#F3E1DB" },
        warning: "#C99A3E",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      spacing: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px", 6: "32px", 7: "48px", 8: "64px", 9: "96px" },
      borderRadius: { sm: "4px", md: "8px", lg: "16px", full: "999px" },
      boxShadow: {
        sm: "0 1px 2px rgba(30,33,25,.08), 0 1px 1px rgba(30,33,25,.04)",
        md: "0 4px 10px rgba(30,33,25,.10), 0 2px 4px rgba(30,33,25,.06)",
        lg: "0 16px 32px rgba(30,33,25,.16), 0 4px 10px rgba(30,33,25,.08)",
      },
      screens: { sm: "560px", md: "768px", lg: "1200px" },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
} satisfies Config;
```

Шрифты подключаются через `next/font` (Fraunces, Inter, IBM Plex Mono) для автоматической оптимизации загрузки и отсутствия layout shift.

---

## 6. Supabase: Auth, Database, Storage, Realtime, Edge Functions

### 6.1 Auth

- Email/пароль + магическая ссылка для B2C-слоя (фаза 2); email/пароль + обязательная верификация компании для B2B-ролей.
- Роли хранятся не в Supabase Auth напрямую, а в таблице `profiles` (см. раздел 7) со ссылкой на `auth.users.id` — гибче для будущих ролей (мультипользовательские компании, менеджеры закупок).
- JWT содержит `role` и `company_id` через custom claims (Supabase Auth Hook), что позволяет строить RLS-политики без дополнительного похода в БД.

### 6.2 Database (Postgres)

Подробная схема — раздел 7. Ключевые принципы:
- Row Level Security (RLS) включён на **всех** таблицах без исключения.
- Мультиарендность на уровне компании (`company_id`) — пользователь видит только свои заказы/каталог, если явно не публичный ресурс.
- `updated_at` триггеры на всех изменяемых таблицах для аудита и корректной ISR-ревалидации.

### 6.3 Storage

| Bucket | Содержимое | Доступ |
|---|---|---|
| `product-images` | Фото товаров | Публичный read, write только владельцем компании (RLS + Storage policies) |
| `verification-docs` | Фитосертификаты, лицензии, VAT-документы | Приватный, доступ — владелец + администратор |
| `order-attachments` | Фото повреждений при спорах, накладные | Приватный, доступ — участники заказа + администратор |
| `avatars` | Логотипы компаний | Публичный read |

Загрузка — напрямую с клиента в Storage через подписанные URL (не через сервер приложения), сервер только валидирует метаданные после загрузки.

### 6.4 Realtime

Каналы Supabase Realtime для:
- Статуса заказа (изменение статуса поставщиком мгновенно отражается у покупателя без перезагрузки)
- Чата между контрагентами и AI-эскалаций
- Уведомлений (колокольчик в шапке, раздел 11.2 UX Bible)

### 6.5 Edge Functions

| Функция | Назначение |
|---|---|
| `ai-assistant` | Приём сообщения → RAG по каталогу/заказам → вызов LLM → возврат структурированного ответа (текст + карточки товаров) |
| `verify-document` | Приём загруженного документа → OCR/базовая проверка формата → постановка в очередь администратора |
| `calculate-shipping` | Расчёт стоимости и сроков доставки на основе адреса, веса, температурного режима |
| `search-index-sync` | Синхронизация изменений каталога в поисковый индекс (при миграции на Meilisearch) |
| `payment-webhook-handler` | Обработка колбэков платёжного провайдера, обновление статуса заказа |

---

## 7. Структура базы данных

### 7.1 ER-диаграмма (укрупнённо)

```
profiles ──┬── companies ──┬── products ──┬── product_images
           │                │              ├── product_price_tiers
           │                │              └── product_attributes
           │                ├── verification_documents
           │                └── company_certifications
           │
           ├── orders ──┬── order_items (→ products)
           │             ├── order_status_history
           │             └── shipments
           │
           ├── carts ── cart_items (→ products)
           ├── conversations ── messages
           ├── reviews (→ companies, orders)
           ├── favorites (→ products / companies)
           ├── disputes (→ orders)
           ├── notifications
           └── ai_chat_sessions ── ai_chat_messages
```

### 7.2 SQL DDL — ключевые таблицы

```sql
-- ==== ПОЛЬЗОВАТЕЛИ И КОМПАНИИ ====

create type user_role as enum ('supplier', 'buyer', 'admin', 'consumer');
create type company_type as enum ('nursery', 'wholesaler', 'garden_center', 'landscaper', 'other');
create type verification_status as enum ('pending', 'approved', 'rejected');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  company_id uuid references companies(id),
  locale text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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
  monthly_purchase_volume text,        -- заполняется покупателями на онбординге
  credit_limit numeric(12,2),          -- для инвойсинга с отсрочкой
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table verification_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  doc_type text not null,               -- 'phytosanitary', 'vat', 'organic_cert', ...
  file_path text not null,              -- путь в Storage bucket verification-docs
  status verification_status default 'pending',
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ==== КАТАЛОГ ====

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id),
  slug text unique not null,
  name jsonb not null,                  -- {"en": "Trees", "ru": "Деревья", "de": "Bäume"}
  attribute_schema jsonb                -- динамические поля характеристик для этой категории
);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  category_id uuid references categories(id),
  slug text unique not null,
  name jsonb not null,                  -- мультиязычное {"en": "...", "ru": "..."}
  description jsonb,
  latin_name text,                      -- для ботанического поиска
  attributes jsonb,                     -- значения по attribute_schema категории
  unit text not null default 'pcs',
  stock_qty numeric not null default 0,
  stock_updated_at timestamptz default now(),
  min_order_qty numeric default 1,
  status text default 'draft',          -- draft | active | hidden | out_of_stock
  search_vector tsvector,               -- полнотекстовый индекс, см. раздел 9
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  file_path text not null,
  position int default 0
);

create table product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  min_qty numeric not null,
  price numeric(10,2) not null,
  currency text default 'EUR'
);

-- ==== ЗАКАЗЫ ====

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
  product_id uuid references products(id),
  qty numeric not null,
  price_snapshot numeric(10,2) not null  -- цена на момент добавления, пересчитывается при чекауте
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,     -- отдельный номер на поставщика при мультивендорной корзине
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
  product_id uuid references products(id),
  product_name_snapshot jsonb not null,  -- фиксируем название/цену на момент заказа
  qty numeric not null,
  unit_price numeric(10,2) not null
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references profiles(id),
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
  sender_id uuid references profiles(id),
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
  raised_by uuid references profiles(id),
  reason text,
  evidence_paths text[],
  resolution text,
  resolved_by uuid references profiles(id),
  status text default 'open',            -- open | resolved
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  product_id uuid references products(id),
  company_id uuid references companies(id),
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  type text not null,                    -- 'order_status' | 'message' | 'system' | 'marketing'
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ==== AI-ПОМОЩНИК ====

create table ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  started_at timestamptz default now()
);

create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references ai_chat_sessions(id) on delete cascade,
  role text not null,                    -- 'user' | 'assistant' | 'tool'
  content text,
  tool_call jsonb,                       -- зафиксированный вызов калькулятора/поиска
  created_at timestamptz default now()
);
```

### 7.3 Индексы (ключевые)

```sql
create index idx_products_company on products(company_id);
create index idx_products_category on products(category_id);
create index idx_products_search on products using gin(search_vector);
create index idx_products_status on products(status) where status = 'active';
create index idx_orders_buyer on orders(buyer_company_id);
create index idx_orders_supplier on orders(supplier_company_id);
create index idx_orders_status on orders(status);
create index idx_messages_conversation on messages(conversation_id, created_at);
create index idx_notifications_unread on notifications(profile_id) where read_at is null;
```

### 7.4 Пример RLS-политики

```sql
alter table products enable row level security;

-- Публичный каталог: видны только активные товары верифицированных компаний
create policy "public_read_active_products"
  on products for select
  using (
    status = 'active'
    and exists (
      select 1 from companies
      where companies.id = products.company_id
      and companies.verification_status = 'approved'
    )
  );

-- Поставщик управляет только своим каталогом
create policy "supplier_manage_own_products"
  on products for all
  using (
    company_id = (select company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select company_id from profiles where id = auth.uid())
  );
```

Аналогичный паттерн («публичное чтение подтверждённого + полный доступ владельцу + доступ администратору по отдельной политике») применяется ко всем таблицам с пользовательским контентом.

---

## 8. API-слой

Основной механизм мутаций — **Server Actions** (вызываются напрямую из форм/компонентов, без ручного описания REST-эндпоинтов). Отдельные **Route Handlers** (`app/api/**`) оставлены только для случаев, требующих внешний HTTP-контракт:

| Route Handler | Назначение |
|---|---|
| `POST /api/webhooks/payment` | Приём колбэков от платёжного провайдера |
| `POST /api/webhooks/shipping` | Обновление статуса доставки от перевозчика |
| `GET /api/sitemap.xml` | Динамическая генерация sitemap (раздел 15) |
| `POST /api/ai/chat` | Прокси к Edge Function `ai-assistant` с потоковым ответом (SSE) для клиентского чата |
| `GET /api/search` | Прокси к поисковому индексу (см. раздел 9), используется клиентскими фильтрами без полной перезагрузки страницы |

**Внутренние Server Actions (примеры):**

```
createProduct(formData) → products.insert + revalidateTag('catalog')
updateStock(productId, qty) → products.update + realtime broadcast
addToCart(productId, qty) → cart_items.upsert
submitOrder(cartId, address, paymentMethod) → orders.insert (по одному на поставщика) + email/notification
confirmOrder(orderId, deadline) → order_status_history.insert + orders.update
raiseDispute(orderId, reason, files) → disputes.insert + notification администратору
```

Каждый Server Action валидирует вход общей Zod-схемой (переиспользуемой с клиентской формой) и полагается на RLS как на последний рубеж защиты — даже если серверная проверка роли будет обойдена, база данных не отдаст чужие данные.

---

## 9. Поиск

### 9.1 MVP (Postgres Full-Text Search)

- `search_vector` (`tsvector`) на `products`, автоматически обновляется триггером из `name`, `description`, `latin_name`, категории.
- Поддержка опечаток и частичного совпадения через `pg_trgm` (`similarity()`) — покрывает сценарий «hydrangea» находит «гортензия» через мультиязычные синонимы, хранимые в `categories.name`/отдельной таблице синонимов `search_synonyms`.
- Фасетные фильтры (раздел 7 UX Bible) реализуются как обычные `WHERE`-условия по индексированным колонкам (`category_id`, `attributes->>'hardiness_zone'`, `stock_qty > 0` и т.д.) в комбинации с полнотекстовым запросом.

```sql
create table search_synonyms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  synonym text not null,
  locale text not null
);

create or replace function products_search_vector_update() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name->>'en','') || ' ' || coalesce(new.name->>'ru','')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.latin_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description->>'en','')), 'B');
  return new;
end;
$$ language plpgsql;

create trigger trg_products_search_vector
  before insert or update on products
  for each row execute function products_search_vector_update();
```

### 9.2 Точка масштабирования (Meilisearch/Typesense)

При росте каталога (десятки/сотни тысяч SKU) и потребности в мгновенном автодополнении (раздел 7.1 UX Bible) — миграция на **Meilisearch** (self-hosted или Cloud): Edge Function `search-index-sync` слушает изменения через Postgres триггер/`pg_net` и обновляет индекс асинхронно, приложение переключает источник фильтров с прямых SQL-запросов на Meilisearch API без изменения UI-слоя.

---

## 10. AI-помощник

### 10.1 Архитектура

```
Клиент (ChatWidget) ──SSE──▶ /api/ai/chat ──▶ Edge Function ai-assistant
                                                      │
                                     ┌────────────────┼───────────────────┐
                                     ▼                ▼                   ▼
                              RAG-поиск по      Function calling:    История диалога
                              products/orders   calculate_volume,    (ai_chat_messages)
                              (через search)    get_order_status,
                                                 compare_suppliers
                                     │
                                     ▼
                              LLM API (Claude) — формирует финальный ответ
                              с текстом + структурированными блоками
                              (карточки товаров, таблицы сравнения)
```

### 10.2 Ключевые решения

- **RAG, а не fine-tuning.** Каталог меняется ежедневно (остатки, цены) — актуальность важнее, чем дообучение модели. Контекст для LLM собирается на лету через SQL/поиск по запросу пользователя.
- **Function calling для калькуляторов.** Запрос «рассчитай, сколько саженцев для изгороди 40 метров» вызывает ту же серверную функцию, что и обычный калькулятор в UI (раздел 9.2 UX Bible), результат возвращается в чат и одновременно доступен как «Добавить в корзину».
- **Скоуп по роли и компании.** Промпт AI-помощника всегда включает `role` и `company_id` пользователя — поставщик не может через чат увидеть чужую аналитику, покупатель не видит закупочные цены поставщика.
- **Эскалация к человеку.** Если модель возвращает низкую уверенность или пользователь явно просит оператора — сессия помечается `escalated`, создаётся `conversation` с администратором/поддержкой.
- **Стриминг ответа** через Server-Sent Events для ощущения живого диалога (UX Bible, раздел 10.2).
- **Ключи и системные промпты никогда не попадают на клиент** — вся логика вызова LLM живёт в Edge Function, клиент общается только с `/api/ai/chat`.

---

## 11. Мультиязычность (i18n)

- **Библиотека:** `next-intl`, маршруты вида `/{locale}/catalog/...`.
- **Стартовые языки:** английский (лингва франка B2B), плюс языки пилотных стран из PRD (например, польский, немецкий, нидерландский) — расширяется по мере географии запуска.
- **Статический UI-текст** — JSON-файлы в `messages/{locale}.json`, вычитка носителями языка перед запуском каждой страны.
- **Контент из БД** (названия товаров, описания, категории) хранится как `jsonb` с ключами по языкам (см. схему `products.name`) — отсутствие перевода не ломает страницу, а откатывается на английский с пометкой для поставщика «переведите карточку для роста конверсии в этой стране».
- **Локализация форматов:** валюта, единицы измерения, формат даты — через `Intl` API на основе `locale`, а не хардкод.
- **hreflang и SEO** — см. раздел 15.4.

---

## 12. Безопасность

### 12.1 Аутентификация и авторизация

- Supabase Auth (JWT), refresh-токены в httpOnly cookie (не в localStorage) — защита от XSS-кражи токена.
- Custom claims (`role`, `company_id`) в JWT через Auth Hook — RLS-политики проверяют их без дополнительного запроса к `profiles`.
- Middleware Next.js проверяет роль на уровне маршрута (`(supplier)`, `(buyer)`, `(admin)`) как первый рубеж, RLS в Postgres — как второй, независимый от frontend.

### 12.2 Защита данных

- RLS включён на 100% таблиц (раздел 7.4) — принцип «база данных не доверяет приложению».
- Персональные и юридические данные компаний (VAT, документы верификации) — отдельный приватный bucket, доступ только владельцу и администратору, ссылки — только подписанные (`signed URL`, TTL 5 минут).
- Шифрование в состоянии покоя — на уровне Supabase/Postgres по умолчанию; шифрование в транзите — TLS везде (Vercel/Supabase enforced HTTPS).
- Соответствие GDPR: экспорт и удаление персональных данных по запросу пользователя (Server Action `requestDataDeletion`), явное согласие на маркетинговые уведомления (раздел 11.2 UX Bible), Data Processing Agreement с субпроцессорами (Supabase, платёжный провайдер, LLM API).

### 12.3 Прикладная безопасность

- Валидация всех входных данных на сервере через Zod, независимо от клиентской валидации.
- Rate limiting на чувствительные Server Actions/Route Handlers (логин, регистрация, AI-чат) через Vercel Edge Middleware + Upstash Redis (защита от брутфорса и злоупотребления AI-квотой).
- Валидация загружаемых файлов: тип, размер, антивирус-сканирование (Supabase Storage + сторонний сервис) перед публикацией фитосертификатов.
- CSRF защищён нативно моделью Server Actions (same-origin токены Next.js); Route Handlers для вебхуков — проверка подписи провайдера (Stripe signature и аналогично).
- Content Security Policy и стандартные security-заголовки (`next.config.ts` → `headers()`), защита от clickjacking (`X-Frame-Options`), санитизация пользовательского контента (описания, отзывы) от XSS.
- Аудит-лог критичных действий (верификация, изменение статуса заказа, решения по спорам) — таблица `order_status_history` и аналогичные для не-заказных действий.

---

## 13. Производительность

| Область | Решение |
|---|---|
| Изображения | `next/image` с автоматическим resize/WebP/AVIF, хранение оригиналов в Supabase Storage, CDN через Vercel Image Optimization |
| Кэширование страниц | ISR с точечной ревалидацией по тегам (`revalidateTag('product:{id}')`) при изменении остатка/цены |
| Кэширование данных | `TanStack Query` на клиенте с `staleTime`, дедупликация параллельных запросов |
| База данных | Индексы по всем полям фильтрации (раздел 7.3), `EXPLAIN ANALYZE` на этапе код-ревью тяжёлых запросов, read-реплики Supabase при росте нагрузки на аналитику |
| Edge | Middleware и статический контент — на Vercel Edge Network (ближе к пользователю по всей Европе) |
| Шрифты | `next/font` — self-hosting Fraunces/Inter/IBM Plex Mono, без блокирующего запроса к Google Fonts в проде |
| Списки каталога | Виртуализация длинных списков (`@tanstack/react-virtual`) на клиентских экранах с сотнями товаров у одного поставщика |
| Бандл | Code splitting по route groups, динамический `import()` для тяжёлых виджетов (AI-чат, калькулятор с визуализацией) — не грузятся, пока не открыты |
| Мониторинг производительности | Vercel Speed Insights (Core Web Vitals по реальным пользователям), алерты при деградации LCP/INP на публичных страницах (важно для SEO, раздел 15) |

---

## 14. Резервное копирование и disaster recovery

| Аспект | Политика |
|---|---|
| Бэкапы БД | Supabase daily automated backups (point-in-time recovery на платных планах) + дополнительный еженедельный экспорт `pg_dump` во внешнее хранилище (например, S3-совместимое) вне периметра Supabase — защита от отказа самого провайдера |
| Хранение бэкапов | Retention 30 дней для ежедневных, 12 месяцев для ежемесячных архивных снапшотов |
| Storage (файлы) | Версионирование бакетов документов верификации; регулярная синхронизация в холодное хранилище |
| RPO / RTO (цель) | RPO ≤ 24 часа на MVP (снижается до нескольких часов при переходе на PITR), RTO ≤ 4 часа для критичных сервисов (каталог, заказы) |
| Тестирование восстановления | Плановое учение по восстановлению из бэкапа не реже раза в квартал, с фиксацией фактического времени восстановления |
| Миграции схемы | Все изменения БД — только через версионируемые файлы в `supabase/migrations`, применяются через CI, откатываемы |
| Отказоустойчивость AI/поиска | Деградация функциональности вместо полного отказа: при недоступности LLM API — AI-виджет показывает fallback «Поиск сейчас работает в обычном режиме» и переключает на стандартный поиск/фильтры вместо ошибки на весь экран |

---

## 15. SEO

### 15.1 Технический SEO

- Публичные страницы (каталог, карточка товара, профиль поставщика, блог) — SSR/ISR, полностью читаемы без выполнения JS.
- `generateMetadata` в Next.js для динамических `<title>`, `description`, Open Graph и Twitter Card по каждой карточке товара/поставщика.
- Канонические URL (`rel=canonical`) для страниц с фильтрами/пагинацией, чтобы не плодить дубли в индексе.
- Динамический `sitemap.xml` (Route Handler, раздел 8) — генерируется из активных товаров/категорий/поставщиков, обновляется по расписанию.
- `robots.txt` закрывает кабинеты (`/dashboard`, `/cart`, `/checkout`) и оставляет открытым публичный каталог.

### 15.2 Структурированные данные (schema.org)

Карточка товара размечается `Product` + `Offer` + `AggregateRating` (JSON-LD), профиль поставщика — `Organization`, блог — `Article` — для расширенных сниппетов в поисковой выдаче (цена, наличие, рейтинг прямо в результатах поиска).

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Thuja occidentalis 'Smaragd'",
  "image": ["https://cdn.tamga.green/..."],
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": "4.20",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "23" }
}
```

### 15.3 Контент и производительность как SEO-факторы

- Core Web Vitals (LCP/INP/CLS) — часть определения готовности релиза для публичных страниц, не только для UX (см. раздел 13, мониторинг).
- Блог/база знаний (заложены в IA ещё на Этапе 2) — основной канал органического трафика для длинных запросов («уход за туей смарагд зимой»), с перелинковкой на релевантные категории каталога.

### 15.4 Мультиязычное SEO

- `hreflang`-теги на каждой странице, перечисляющие все доступные локали той же страницы, плюс `x-default`.
- Локализованные `slug` там, где это осмысленно для языка (категории), при этом `product.id`/внутренние идентификаторы остаются языконезависимыми.
- Локализованные sitemap — отдельный sitemap-индекс на локаль, чтобы поисковые системы каждой страны корректно обходили нужную версию.

---

## 16. Инфраструктура, окружения, CI/CD

| Окружение | Назначение |
|---|---|
| `local` | Supabase CLI (локальный Postgres в Docker) + Next.js dev server |
| `preview` | Автоматический деплой на Vercel Preview для каждого PR, отдельная ветка Supabase (при использовании Supabase Branching) для изолированного тестирования миграций |
| `staging` | Полная копия прод-конфигурации с тестовыми данными, ручное приёмочное тестирование перед релизом |
| `production` | Vercel Production + Supabase Production project, ограниченный доступ на прямые изменения БД (только через миграции) |

**CI/CD (пример пайплайна):** lint → typecheck → unit-тесты → сборка → применение миграций к preview-БД → e2e-тесты (Playwright) на критичных флоу (регистрация, оформление заказа, AI-чат) → деплой на Vercel Preview → ручное approve для прод-релиза → применение миграций к prod → деплой.

---

## 17. Итоговая диаграмма системы

```
                              ┌─────────────────────────────┐
                              │        Пользователь          │
                              │  Поставщик / Покупатель /     │
                              │  Администратор / Потребитель  │
                              └───────────────┬───────────────┘
                                              │ HTTPS
                              ┌───────────────▼───────────────┐
                              │     Next.js (Vercel Edge)      │
                              │  App Router · SSR/ISR · Tailwind│
                              │  Server Actions · next-intl     │
                              └───────┬───────────────┬────────┘
                                      │               │
                     ┌────────────────▼───┐   ┌───────▼─────────────┐
                     │   Supabase Postgres  │   │  Supabase Storage    │
                     │   RLS · Full-Text     │   │  фото / документы     │
                     │   Search · Триггеры   │   └──────────────────────┘
                     └───────────┬───────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Supabase Edge Functions  │
                    │  AI-помощник (LLM+RAG)      │
                    │  Верификация · Логистика    │
                    │  Платёжные вебхуки           │
                    └───────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                                 ▼
        LLM API (Claude)                 Внешние сервисы
        Платёжный провайдер               (перевозчики, OCR,
                                            Meilisearch при масштабе)
```

**Следующий шаг:** Этап 5 — детализация по вашему плану (например, приоритизация MVP-функциональности, дорожная карта разработки по спринтам, или техническое задание по отдельным модулям).

---

*Документ подготовлен как Этап 4 проекта Tamga Green. Основан на ролях, экранах и токенах, зафиксированных на Этапах 1–3. Готов к техническому ревью и передаче в разработку.*
