# Tamga Green
## Database Design
### Этап 5 — Проектирование таблиц и связей

**Версия документа:** 1.0
**Роль автора:** Senior Software Architect / Database Architect
**Опирается на:** PRD (Этап 1), UX Bible (Этап 2), System Architecture (Этап 4)
**Статус:** Черновик для технического ревью, уточняет и расширяет схему БД из Этапа 4

> **Как это соотносится с Этапом 4.** В Архитектуре (Этап 4) уже была спроектирована транзакционная часть БД — `companies`, `products`, `orders`, `disputes` и т.д. Этот документ фокусируется на списке сущностей, который вы прислали, и по ходу немного **уточняет** схему Этапа 4 в сторону более классической нормализации: `products` → `plants` (более точное имя для питомниководческого каталога), мультиязычные `jsonb`-поля → отдельная таблица `translations`, встроенный `attributes jsonb` → полноценные EAV-таблицы `attributes`/`plant_attribute_values`. Раздел 8 в конце — точная сверка различий, ничего не потеряно, часть полей просто вынесена в отдельные таблицы для гибкости фильтров и переводов. Транзакционные таблицы (`orders`, `carts`, `disputes`, `reviews`, `ai_chat_*`) остаются такими же, как в Этапе 4, только с обновлённым `foreign key` на `plants` вместо `products`.

---

## Оглавление

1. Принципы проектирования
2. ER-диаграмма (укрупнённо)
3. Каталог: Categories, Plants, Plant Images, Attributes, Availability, Prices
4. Пользователи и лиды: Users, Requests
5. Контент и портфолио: Projects, Landscape Solutions, Gallery, Blog, FAQ
6. Система: Translations, Settings, AI Cache
7. Сводная таблица связей и индексы
8. Сверка с Этапом 4

---

## 1. Принципы проектирования

1. **Нормализация с осознанными исключениями.** Основные сущности нормализованы (3НФ); `settings.value` и `ai_cache.response` намеренно остаются `jsonb`, потому что это неструктурированная/переменная по форме конфигурация, а не бизнес-данные, требующие целостности через внешние ключи.
2. **Переводы — отдельной таблицей.** Вместо `jsonb`-колонок с языковыми ключами (как в Этапе 4) используется единая полиморфная таблица `translations` — она проще для CMS-редактора контента (блог, FAQ, лендинги решений) и позволяет добавлять новый язык без миграции схемы.
3. **EAV только там, где он оправдан.** Атрибуты растений (`attributes`/`plant_attribute_values`) — классический пример оправданного EAV: у дерева, кустарника и грунта принципиально разный набор характеристик, а фильтры в каталоге (Этап 2, раздел 7.2) должны строиться динамически по категории.
4. **Полиморфные связи — по конвенции `entity_type` + `entity_id`, без FK-constraint.** Postgres не поддерживает полиморфные внешние ключи нативно; используется там, где сущность объективно переиспользуется в разных контекстах (`translations`, `gallery_images`, `requests.subject`). Целостность в этих случаях обеспечивается на уровне приложения и `CHECK`-ограничений на допустимые `entity_type`.
5. **Мягкое удаление там, где это публичный контент.** У `plants`, `projects`, `blog_posts`, `landscape_solutions` — статусное поле (`draft/active/archived`) вместо физического `DELETE`, чтобы не ломать SEO-индексацию и историю заказов, ссылающихся на архивные товары.

---

## 2. ER-диаграмма (укрупнённо)

```
                         ┌───────────────┐
                         │  categories    │◄─────────┐
                         └───────┬────────┘          │ parent_id (self-ref)
                                 │ 1:N                │
                         ┌───────▼────────┐   ┌───────┴────────┐
                         │    plants       │   │  attributes    │
                         │                 │◄──┤ (per category) │
                         └──┬───┬───┬──────┘   └───────┬────────┘
                    1:N     │   │   │ 1:N              │ 1:N
              ┌─────────────┘   │   └───────────┐      │
              ▼                 ▼                ▼      ▼
      plant_images        availability        prices  plant_attribute_values
              │
              │ (translations — полиморфно к plants.name/description)
              ▼
         translations ◄──── categories, landscape_solutions, projects,
                             blog_posts, faq_items, settings (по field)

  users ──N:1── companies          requests ──N:1── users (nullable)
    │                                  │ полиморфно к
    │                                  ▼
    │                          plants / landscape_solutions / projects
    │
    └── projects (company_id) ──M:N── landscape_solutions (project_solutions)
              │                              │
              │ 1:N (полиморфно)             │ M:N
              ▼                              ▼
        gallery_images                  solution_plants ──N:1── plants

  blog_categories ──1:N── blog_posts ──1:N (полиморфно)── gallery_images
  faq_categories ──1:N── faq_items

  ai_cache — независимая таблица кэша (без FK, ключ — хэш запроса)
```

---

## 3. Каталог: Categories, Plants, Plant Images, Attributes, Availability, Prices

```sql
-- ==== КАТЕГОРИИ (дерево) ====
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  slug text unique not null,
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);
-- Название/описание категории хранится в translations (entity_type='category')

-- ==== РАСТЕНИЯ / ТОВАРЫ КАТАЛОГА ====
create table plants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,  -- поставщик-владелец (таблица companies из Этапа 4)
  category_id uuid references categories(id),
  slug text unique not null,
  latin_name text,                     -- ботаническое название, языконезависимо
  sku text,
  unit text not null default 'pcs',
  status text not null default 'draft', -- draft | active | hidden | out_of_stock | archived
  is_plant boolean not null default true, -- false = сопутствующий товар (инструмент, грунт) в том же каталоге
  min_order_qty numeric default 1,
  cover_image_id uuid,                 -- денормализация для быстрого рендера карточки (см. plant_images)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Название/описание растения хранится в translations (entity_type='plant')

-- ==== ФОТО ТОВАРА ====
create table plant_images (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  file_path text not null,             -- путь в Supabase Storage bucket product-images
  alt_text text,                       -- для SEO/доступности, не переводится через translations — короткий тех.текст
  position int default 0,
  is_cover boolean default false
);

alter table plants
  add constraint fk_cover_image foreign key (cover_image_id) references plant_images(id) on delete set null;

-- ==== ОПРЕДЕЛЕНИЯ АТРИБУТОВ (динамические характеристики по категории) ====
create table attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),  -- null = атрибут общий для всех категорий
  code text unique not null,             -- 'hardiness_zone', 'pot_diameter', 'sun_exposure'
  data_type text not null check (data_type in ('text','number','boolean','enum')),
  unit text,                             -- 'cm', '°C', 'л'
  enum_options jsonb,                    -- варианты для data_type='enum': ["zone_5","zone_6","zone_7"]
  is_filterable boolean default true,    -- участвует ли в фасетных фильтрах каталога (Этап 2, 7.2)
  sort_order int default 0
);

-- ==== ЗНАЧЕНИЯ АТРИБУТОВ ДЛЯ КОНКРЕТНОГО ТОВАРА (EAV) ====
create table plant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  attribute_id uuid references attributes(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  unique (plant_id, attribute_id)
);

-- ==== ОСТАТКИ / ДОСТУПНОСТЬ ====
create table availability (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  location text,                        -- конкретный склад/поле питомника (для крупных поставщиков с несколькими площадками)
  quantity numeric not null default 0,
  season_start date,                    -- сезонная доступность (например, луковичные — осень)
  season_end date,
  updated_at timestamptz default now()
);

-- ==== ЦЕНЫ (ступенчатые, мультивалютные) ====
create table prices (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade,
  min_qty numeric not null default 1,   -- ступень объёма ("от 50 шт")
  price numeric(10,2) not null,
  currency text not null default 'EUR',
  valid_from date default current_date,
  valid_to date                         -- null = бессрочно, используется для сезонных промо-цен
);
```

**Логика цены товара для покупателя:** приложение выбирает из `prices` строку с максимальным `min_qty ≤ запрошенное количество`, `currency` = валюта покупателя (или ближайшая с конвертацией), `valid_from ≤ сегодня ≤ valid_to (или valid_to is null)`.

---

## 4. Пользователи и лиды: Users, Requests

```sql
-- ==== ПОЛЬЗОВАТЕЛИ (профиль поверх auth.users; companies — из Этапа 4) ====
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
-- Функционально это та же роль, что profiles в Этапе 4 — имя выровнено под ваш список сущностей.

-- ==== ЗАЯВКИ / ЛИДЫ ====
-- Отдельная от "orders" (Этап 4) сущность: это не оформленный B2B-заказ,
-- а входящий запрос — консультация по ландшафтному решению, запрос цены,
-- уведомление о поступлении растения в наличие, общий контакт с платформой.
create table requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),     -- null — анонимный лид (гость с публичного сайта)
  type text not null check (type in ('quote','contact','project_consultation','plant_availability_alert')),
  subject_type text check (subject_type in ('plant','landscape_solution','project')),
  subject_id uuid,                       -- полиморфная ссылка на предмет заявки
  name text,
  email text,
  phone text,
  message text,
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  assigned_to uuid references users(id), -- менеджер/администратор, взявший заявку в работу
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Пример использования `requests`:** покупатель на карточке товара с нулевым остатком нажимает «Сообщить о поступлении» → создаётся `requests` с `type='plant_availability_alert'`, `subject_type='plant'`, `subject_id=<id товара>`; когда поставщик обновляет `availability.quantity` с 0 на положительное значение — триггер/Edge Function рассылает уведомления всем связанным `requests` со статусом `new` и переводит их в `closed`.

---

## 5. Контент и портфолио: Projects, Landscape Solutions, Gallery, Blog, FAQ

```sql
-- ==== ГОТОВЫЕ ЛАНДШАФТНЫЕ РЕШЕНИЯ (каталог услуг/пакетов) ====
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
-- Название/описание — через translations (entity_type='landscape_solution')

-- Связь решения с типовым набором растений, которые оно использует
create table solution_plants (
  solution_id uuid references landscape_solutions(id) on delete cascade,
  plant_id uuid references plants(id) on delete cascade,
  qty_per_unit numeric,                  -- например, "3 куста на погонный метр изгороди"
  primary key (solution_id, plant_id)
);

-- ==== ПРОЕКТЫ (портфолио выполненных работ / кейсы) ====
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),   -- чья это работа (Tamga Green или партнёр-ландшафтник)
  request_id uuid references requests(id),    -- если проект возник из заявки на консультацию
  slug text unique not null,
  location text,
  area_sqm numeric,
  completed_at date,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz default now()
);
-- Заголовок/описание — через translations (entity_type='project')

-- Какие решения использовались в проекте (для перелинковки "решение → примеры реализации")
create table project_solutions (
  project_id uuid references projects(id) on delete cascade,
  solution_id uuid references landscape_solutions(id) on delete cascade,
  primary key (project_id, solution_id)
);

-- ==== ГАЛЕРЕЯ (полиморфная — используется проектами, решениями, статьями блога) ====
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
-- Название категории блога — через translations (entity_type='blog_category')

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
-- Заголовок/текст статьи — через translations (entity_type='blog_post')

-- ==== FAQ ====
create table faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  sort_order int default 0
);
-- Название категории FAQ — через translations (entity_type='faq_category')

create table faq_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references faq_categories(id),
  sort_order int default 0
);
-- Вопрос/ответ — через translations (entity_type='faq_item', field='question'|'answer')
```

---

## 6. Система: Translations, Settings, AI Cache

```sql
-- ==== ПЕРЕВОДЫ (единая полиморфная таблица мультиязычного контента) ====
create table translations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'plant','category','landscape_solution','project',
    'blog_post','blog_category','faq_item','faq_category','setting'
  )),
  entity_id uuid not null,
  field text not null,           -- 'name' | 'description' | 'title' | 'body' | 'question' | 'answer'
  locale text not null,          -- 'en' | 'ru' | 'de' | 'pl' | 'nl' ...
  value text,
  updated_at timestamptz default now(),
  unique (entity_type, entity_id, field, locale)
);

-- ==== НАСТРОЙКИ ПЛАТФОРМЫ (key-value конфигурация) ====
create table settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,      -- 'default_currency', 'support_email', 'feature_flag_b2c_storefront'
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ==== КЭШ AI-ОТВЕТОВ ====
-- Требует расширение pgvector для семантического поиска по кэшу (не только по точному хэшу запроса)
create extension if not exists vector;

create table ai_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text unique not null,     -- sha256 нормализованного запроса + контекста (роль, локаль)
  query_text text not null,
  response jsonb not null,             -- текст ответа + структурированные блоки (карточки, таблицы)
  embedding vector(1536),              -- для поиска "похожих" вопросов, а не только идентичных
  hit_count int default 1,
  created_at timestamptz default now(),
  expires_at timestamptz               -- TTL — важно, т.к. остатки/цены "протухают" (см. Этап 2, 2.3)
);
```

**Зачем `ai_cache`, а не только история в `ai_chat_messages` (Этап 4).** `ai_chat_messages` — это лог диалога конкретного пользователя. `ai_cache` — общий кэш «вопрос → ответ» между пользователями (например, «какие растения для живой изгороди в зоне 5 морозостойкости» будут спрашивать многие), что экономит вызовы LLM API. Обязательный `expires_at`, потому что ответы часто зависят от остатков/цен, которые меняются ежедневно.

---

## 7. Сводная таблица связей и индексы

### 7.1 Связи

| Таблица A | Тип связи | Таблица B | Смысл |
|---|---|---|---|
| categories | 1:N (self) | categories | Дерево категорий через `parent_id` |
| categories | 1:N | plants | Категория содержит много товаров |
| categories | 1:N | attributes | Категория определяет набор характеристик |
| plants | 1:N | plant_images | Товар — несколько фото |
| plants | 1:N | availability | Товар — остатки по нескольким локациям/сезонам |
| plants | 1:N | prices | Товар — ступенчатые цены |
| plants | M:N (via plant_attribute_values) | attributes | Товар имеет значения для набора атрибутов |
| companies | 1:N | plants | Поставщик владеет каталогом |
| companies | 1:N | users | Компания — несколько сотрудников/пользователей |
| users | 1:N | requests | Пользователь оставляет заявки (может быть null — гость) |
| requests | N:1 (полиморфно) | plants / landscape_solutions / projects | Заявка привязана к предмету интереса |
| landscape_solutions | M:N (via solution_plants) | plants | Решение состоит из типового набора растений |
| projects | M:N (via project_solutions) | landscape_solutions | Проект реализует одно или несколько решений |
| projects / landscape_solutions / blog_posts | 1:N (полиморфно) | gallery_images | Фотогалерея сущности |
| blog_categories | 1:N | blog_posts | Категория блога — много статей |
| faq_categories | 1:N | faq_items | Категория FAQ — много вопросов |
| plant / category / landscape_solution / project / blog_post / faq_item / setting | 1:N (полиморфно) | translations | Мультиязычные поля любой сущности |
| — | — | ai_cache | Независимая таблица, без FK, ключ — `query_hash` |

### 7.2 Индексы

```sql
create index idx_plants_category on plants(category_id);
create index idx_plants_company on plants(company_id);
create index idx_plants_status on plants(status) where status = 'active';
create index idx_plant_attr_values_plant on plant_attribute_values(plant_id);
create index idx_plant_attr_values_attr on plant_attribute_values(attribute_id);
create index idx_availability_plant on availability(plant_id);
create index idx_prices_plant on prices(plant_id, min_qty);

create index idx_requests_status on requests(status);
create index idx_requests_subject on requests(subject_type, subject_id);

create index idx_gallery_entity on gallery_images(entity_type, entity_id);
create index idx_translations_lookup on translations(entity_type, entity_id, locale);

create index idx_blog_posts_status on blog_posts(status, published_at desc);
create index idx_faq_items_category on faq_items(category_id, sort_order);

create unique index idx_ai_cache_hash on ai_cache(query_hash);
create index idx_ai_cache_embedding on ai_cache using ivfflat (embedding vector_cosine_ops);
create index idx_ai_cache_expiry on ai_cache(expires_at);
```

---

## 8. Сверка с Этапом 4

| Этап 4 | Этап 5 | Комментарий |
|---|---|---|
| `products` | `plants` | Переименовано под ваш список сущностей; поле `is_plant` позволяет хранить в той же таблице и непрофильные товары (инструменты, грунт), не заводя вторую параллельную таблицу |
| `products.name jsonb`, `description jsonb` | `translations` (entity_type='plant') | Вынесено в отдельную таблицу — удобнее для CMS-редактирования контента без миграций схемы при добавлении языка |
| `products.attributes jsonb` | `attributes` + `plant_attribute_values` | Полноценный EAV вместо свободного jsonb — даёт возможность строить типобезопасные фасетные фильтры и валидацию значений на уровне БД |
| `product_price_tiers` | `prices` | То же назначение, добавлены `valid_from`/`valid_to` для сезонных цен |
| — (не было) | `availability` | Ранее остаток хранился прямо в `products.stock_qty`; вынесен в отдельную таблицу, чтобы поддержать несколько локаций/сезонность у одного поставщика |
| `profiles` | `users` | Переименовано для соответствия вашему списку; функция та же |
| — (не было) | `requests`, `projects`, `landscape_solutions`, `gallery_images`, `blog_*`, `faq_*` | Новый контентный слой — портфолио, услуги, лидогенерация и маркетинговый контент, не входившие в транзакционную часть Этапа 4 |
| — (не было) | `settings` | Явная таблица конфигурации вместо переменных окружения для всего, что должно редактироваться администратором без деплоя |
| — (не было) | `ai_cache` | Оптимизация поверх `ai_chat_messages` из Этапа 4 — общий кэш ответов, а не только персональная история |
| `orders.product_id`, `cart_items.product_id`, `favorites.product_id` | → `plant_id` | Внешние ключи транзакционных таблиц из Этапа 4 переименовываются вслед за `products` → `plants`; сами таблицы (`orders`, `cart_items`, `favorites`, `disputes`, `reviews`) не меняются структурно |

**Итог:** ни одна таблица из Этапа 4 не удаляется — транзакционное ядро (заказы, корзина, споры, отзывы, чат) остаётся как есть, только с обновлёнными именами внешних ключей. Этап 5 добавляет контентный и справочный слой, которого не было в исходной архитектуре, и делает каталог/переводы более гибкими для реальной эксплуатации.

**Следующий шаг:** Этап 6 — по вашему плану (например, приоритизация MVP по функциональным модулям, техническое задание на конкретные экраны или план миграций/сидинга тестовых данных).

---

*Документ подготовлен как Этап 5 проекта Tamga Green. Уточняет и расширяет схему БД из Этапа 4 согласно списку сущностей, предоставленному для этого этапа.*
