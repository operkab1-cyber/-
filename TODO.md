# TODO — Tamga Green

## Phase 0 — План (эта сессия)

- [x] Прочитаны все 9 документов (PRD, UX Bible, Design Tokens, System Architecture,
      Database Design, AI Architecture, Plant Catalog, Admin Panel, SEO Strategy) +
      `Tamga_Green_Build_Prompt.md` + оба актива (`plants-catalog.json`,
      `landscaping_calculator.html`) + `tamga_green_design_system.html`.
- [x] Проверен черновой каркас из прошлой (офлайн) сессии — см. раздел
      «Ревизия существующего каркаса» ниже.
- [x] Составлен план по фазам (этот файл).

### [решено самостоятельно] — фиксация допущений Phase 0

- **Пилотная локаль.** PRD (Этап 1, раздел 5.1) предлагает Нидерланды/Бельгию или
  Польшу как пилотный рынок, но реальные сид-данные (`plants-catalog.json`,
  `landscaping_calculator.html`) — это прайс конкретного питомника «Дебский»
  (Кыргызстан, цены в сомах, весь текст на русском). Решение: `next-intl` настраивается
  на `en` (лингва франка B2B, как в Architecture §11) + `ru` (язык реальных данных
  и всех активов) вместо польского/нидерландского — так каталог из seed сразу
  осмысленно рендерится на пилотной локали. Остальные локали (`de`, `pl`, `nl`)
  добавляются по мере реальной экспансии, схема `translations` это уже поддерживает.
- **Валюта.** Цены остаются в KGS (сом) как есть в исходных данных, поле
  `prices.currency` — per-row, без принудительной конвертации в EUR (платформа
  мультивалютна по схеме, конвертация — не задача MVP).
- **Компания-поставщик по умолчанию.** Питомник «Дебский» заводится в seed как
  первая верифицированная компания (`companies`, `verification_status='approved'`,
  `country='KG'`) — это реальный поставщик, а не тестовая заглушка, все 165 позиций
  принадлежат ему через `plants.company_id`.
- **Embedding-модель.** AI Architecture называет LLM = Claude, но не называет
  конкретную embedding-модель для `ai_cache.embedding vector(1536)` и AI-поиска.
  Решение: Voyage AI embeddings (рекомендованный партнёр Anthropic) на Phase 6 —
  меняется на любую другую без изменения схемы (колонка просто `vector(N)`).
- **Схема БД — источник истины.** Database Design (Этап 5) сам себя объявляет
  уточнением Архитектуры (Этап 4): `products`→`plants`, `profiles`→`users`,
  `jsonb`-мультиязычность→`translations`, `attributes jsonb`→EAV. Миграции следуют
  Этапу 5 буквально; транзакционные таблицы из Этапа 4 (`orders`, `cart_items`,
  `carts`, `favorites`, `disputes`, `reviews`, `conversations`, `messages`,
  `notifications`, `ai_chat_sessions/messages`, `companies`, `verification_documents`)
  переносятся как есть с FK, переименованными на `plant_id` (раздел 8 сверки).

### Ревизия существующего каркаса (из прошлой офлайн-сессии, без доступа в интернет)

В сессию был приложен ZIP с частичным каркасом (Next.js + `tailwind.config.ts` +
`0001_init_catalog.sql` + `seed.sql` на 165 позиций + пара компонентов). Проверено
построчно против реальных документов (которых у той сессии не было, писала по
памяти) — совпадает почти дословно:
- `tailwind.config.ts` — цвета/шрифты/spacing/radius/shadows/screens совпадают
  1:1 с `Tamga_Green_Design_Tokens.md` и примером конфига в System Architecture §5.
  Не хватает `@tailwindcss/typography` в plugins (в доке architecture есть) — добавить.
- `0001_init_catalog.sql` — схема каталога (`categories/plants/plant_images/
  attributes/plant_attribute_values/availability/prices/translations`) совпадает
  с Database Design §3/§6 дословно, включая индексы и RLS на публичное чтение.
- `seed.sql` — реально сгенерирован из `plants-catalog.json` (165 строк, транслит-slug),
  но **атрибуты (EAV) не заполнены** — это открытая задача на Phase 3.
- Остальное (companies/users/orders/auth/AI/SEO) — не начато, потребует новых миграций.

**Решение:** не выбрасывать каркас, а взять его как основу Phase 1 и провести через
`npm install`/`supabase start`/`npm run build` (чего прошлая сессия не могла сделать
без интернета/Docker) + дополнить недостающими миграциями и правками.

---

## Phase 1 — Каркас

- [ ] Скопировать/интегрировать существующий каркас в репозиторий (App Router,
      route groups `(public)/(auth)/(supplier)/(buyer)/(admin)` — System Architecture §2).
- [ ] `npm install`, поднять `supabase init && supabase start` (Docker), проверить
      `.env.local` из `.env.example`.
- [ ] Миграция `0002_transactional.sql`: `companies`, `verification_documents`,
      `users` (Database Design §4, FK на `auth.users`), `orders`, `order_items`,
      `order_status_history`, `shipments`, `carts`, `cart_items`, `conversations`,
      `messages`, `reviews`, `disputes`, `favorites`, `notifications`,
      `ai_chat_sessions`, `ai_chat_messages`, `requests` (§4), `settings`, `ai_cache`
      (+`pgvector` extension) — из Database Design §4/§6 + Architecture §7 (сверка §8).
      Обновить FK старой миграции 0001, где нужно `plant_id`.
- [ ] Миграция `0003_content.sql`: `landscape_solutions`, `solution_plants`,
      `projects`, `project_solutions`, `gallery_images`, `blog_categories`,
      `blog_posts`, `faq_categories`, `faq_items`, `plant_compatibility`
      (Plant Catalog §8) — контентный слой из Database Design §5.
- [ ] Миграция `0004_audit.sql`: `audit_log`, `price_change_log` (Admin Panel §9, §4.2).
- [ ] RLS: политика на **каждую** таблицу без исключений (Database Design §7.4) —
      публичное чтение подтверждённого контента + владелец управляет своим +
      отдельная политика для `admin`. Пройтись по чек-листу — не должно остаться
      таблиц без `enable row level security`.
- [ ] Обновить `seed.sql`: добавить компанию «Питомник Дебский» (approved),
      привязать `plants.company_id`, базовые `prices`/`availability` из `p`/`oos`
      полей JSON.
- [ ] `next-intl`: locale `en` + `ru`, middleware для локали (уже есть заготовка —
      проверить/доработать).
- [ ] **DoD:** `npm run build` проходит без ошибок на каркасе (пустые страницы-заглушки
      по route groups допустимы).

## Phase 2 — Аутентификация и онбординг

- [ ] Выбор роли (UX Bible §4.1), форма регистрации компании с доп. шагами для
      Поставщика/Покупателя (§4.2), валидация VAT по маске страны, дубликат email.
- [ ] Загрузка документов верификации в Storage (`verification-docs`, приватный
      bucket, подписанные URL, System Architecture §6.3).
- [ ] Экран статуса верификации (§4.3): Загружено → На проверке → Подтверждено/Отклонено.
- [ ] Server Actions с Zod-схемами (регистрация, загрузка документа).
- [ ] RLS-проверка вручную: 2 тестовых аккаунта, один не видит `companies`/`users`/
      `verification_documents` другого напрямую через Supabase client.

## Phase 3 — Каталог

- [ ] Дерево категорий (Plant Catalog §1.1: Хвойные→Туи/Можжевельники/Ели и
      сосны/Тис, Лиственные кустарники→Барбарис/Гортензии/Пузыреплодник/
      Бересклет/Вейгела, Деревья→Клёны/Граб,бук/Гинкго,ива, Почвопокровные и
      лианы, Декоративные травы) — сопоставить с 4 категориями JSON
      (conifer/shrub/tree/grass) как под-разбивка.
- [ ] Страница категории (§1.2), карточка товара (§2), грид-карточка (§3).
- [ ] Динамические фильтры по `attributes.is_filterable` (§4) + сквозные
      (наличие/цена/регион/рейтинг/верификация).
- [ ] Поиск: `tsvector` + `pg_trgm` (Architecture §9.1) — AI/embedding-канал позже
      (Phase 6).
- [ ] Сравнение растений (§6, до 4 позиций, одна категория).
- [ ] `requests` флоу «Запросить цену» / «Сообщить о поступлении» (§11).
- [ ] AI-описания (AI Architecture §6): парсер регулярками (Co\d+, ШТАМБ,
      диапазон высоты, латынь в скобках) → LLM только на неоднозначный остаток →
      генерация 2-3 предложений описания → статус `draft`, публикует поставщик.
  - [ ] Прогнать пайплайн на 20 позициях вручную, проверить качество разбора.
  - [ ] Затем прогнать на оставшихся ~145.
- [ ] Пустые/error-состояния по UX Bible §2.1/§2.2 (нет результатов, 5xx, товар
      закончился между просмотром и чекаутом).

## Phase 4 — Корзина и заказы

- [ ] Мультивендорная корзина, группировка по поставщику, минимальный объём
      заказа, live-пересчёт цены по ступеням (UX Bible §8.1).
- [ ] Чекаут: адрес → доставка → оплата → подтверждение (§8.2).
- [ ] Статусы заказа (`orders.status`), канбан для поставщика (§5.3).
- [ ] `requests` для нестандартных объёмов (Plant Catalog §11.2 — flow `quote`).
- [ ] Спор (`disputes`) — базовый флоу (§15.4 UX Bible).

## Phase 5 — CMS / админка поставщика

- [ ] Дашборд каталога (Admin Panel §2: счётчики, быстрые действия).
- [ ] Добавление растения — степпер 4 шага (§3.1), дублирование (§3.2).
- [ ] Инлайн-редактирование цен (§4.1) и остатков (§5.1), realtime-обновление
      у покупателей на открытой странице товара.
- [ ] Массовое изменение цен/остатков с предпросмотром «до/после» (§4.2/§5.4).
- [ ] Загрузка фото с AI-проверкой (§6, AI Architecture §7 — pHash/vision заглушка
      допустима на MVP, если vision-модель дорога — зафиксировать как upgrade).
- [ ] Импорт Excel: загрузка → сопоставление колонок → AI-разбор с таблицей
      «было/стало» и уверенностью → категоризация → подтверждение (§7.1–7.6).
      **Обязательно протестировать на реальном формате** (эмулировать исходный
      прайс питомника «Дебский» из `plants-catalog.json`/`landscaping_calculator.html`).
- [ ] Аналитика: «продажи за период» + «топ по спросу» минимум (§8.1).
- [ ] `audit_log` на все массовые операции и импорты (§9).

## Phase 6 — AI MVP

- [ ] AI-описания — уже частично в Phase 3, довести до продакшн-пайплайна
      (асинхронная фоновая обработка при массовом импорте, AI Architecture §13.3).
- [ ] AI-поиск: embedding-канал (Voyage AI, см. решение выше) + RRF-fusion с
      `tsvector`, кэш в `ai_cache`.
- [ ] AI-калькуляторы: объём для проекта (детерминированная формула + LLM только
      на разбор свободного текста), экономия при опте (формула + LLM-обёртка
      объяснения) — AI Architecture §12.
- [ ] Остальные 7 AI-функций — не реализуются в MVP, зафиксировать как backlog-заглушки
      (AI-подбор, AI-дизайнер, AI-проверка фото полноценная, AI-переводы,
      AI-помощник менеджеру, AI-рекомендации, AI-генерация решений).

## Phase 7 — SEO

- [ ] URL-структура по SEO Strategy §1 (`/{locale}/catalog/{category}/{product}/`, и т.д.).
- [ ] `generateMetadata` по шаблонам §6.1 (товар/категория/поставщик/блог).
- [ ] JSON-LD: `Product`+`Offer`+`AggregateRating`+`BreadcrumbList` на товаре,
      `CollectionPage`+`ItemList` на категории, `WebSite`+`SearchAction` на главной.
- [ ] `robots.txt` (§5.1), sitemap-индекс + по-локальные сабсайтмапы (§4).
- [ ] `hreflang` (en/ru + x-default).
- [ ] Core Web Vitals: `next/image priority` на LCP-фото, skeleton вместо resize,
      `useTransition` на фильтрах — прогнать Lighthouse на карточке товара и
      категории, цели LCP≤2.5s/INP≤200ms/CLS≤0.1 (§7.1).

## Phase 8 — Калькулятор озеленения

- [ ] Перенести JS-логику `landscaping_calculator.html` в клиентский React-остров
      `/[locale]/calculator`.
- [ ] Каталог калькулятора — из реальных данных БД (`plants`+`prices`+`availability`
      по компании «Дебский» или по выбранному поставщику), а не хардкод JSON.
- [ ] Оставить как есть: логика сметы (газон/декор/работы), тарифы в
      `details.admin` (перенести в `settings`/панель поставщика при желании,
      но не обязательно для MVP), формирование заявки в WhatsApp.

## Phase 9 — Финальная проверка перед демо

- [ ] Happy-path флоу из UX Bible §15 пройдены руками (покупатель ищет и заказывает,
      поставщик обрабатывает заказ, онбординг поставщика, спор).
- [ ] Нет console-ошибок на ключевых страницах.
- [ ] `npm run typecheck` и `npm run lint` чистые.
- [ ] RLS проверен на попытке доступа к чужим данным (повтор Phase 2 теста на
      финальной схеме).
- [ ] Деплой на Vercel + Supabase без ручных правок.

---

*Каждая фаза — отдельная сессия/итерация, отчёт после фазы: что сделано, что
отклонилось от документов и почему, что осталось здесь в TODO.md.*
