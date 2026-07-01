# AI Procurement Agent

Автоматизированный AI-агент для закупок на базе WhatsApp. Ведёт переписку с поставщиками, анализирует документы (PDF, Word, Excel, фото), сохраняет историю и генерирует сравнительные отчёты.

---

## Возможности

- Автоматические ответы поставщикам в WhatsApp (входящие сообщения)
- Разбор вложений: PDF, Word (.docx), Excel (.xlsx/.xls), фото (OCR)
- Извлечение данных: цены, сроки, условия оплаты
- Хранение истории каждого поставщика в Supabase
- Генерация Excel-таблицы сравнения предложений
- Word-отчёт с рекомендацией лучшего поставщика
- Очередь обработки BullMQ (до 5 параллельных диалогов)

---

## Стек

| Слой | Технология |
|---|---|
| WhatsApp | whatsapp-web.js |
| AI | OpenAI GPT-4o |
| БД | Supabase (PostgreSQL) |
| Очереди | BullMQ + Redis |
| OCR | Tesseract.js (ru / kz / en) |
| Отчёты | ExcelJS, docx |
| Runtime | Node.js 20+ · TypeScript |

---

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/pixel-yerzat/ai-procurement-agent.git
cd ai-procurement-agent
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Заполнить `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

REDIS_URL=redis://localhost:6379
WA_SESSION_PATH=./sessions
REPORT_OUTPUT_DIR=./reports
```

### 3. Создать базу данных в Supabase

1. Открыть [supabase.com](https://supabase.com) → создать проект
2. Перейти в **SQL Editor**
3. Скопировать и выполнить содержимое файла [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)

### 4. Запустить Redis

```bash
docker-compose up -d
```

> Требуется [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 5. Запустить агент

```bash
npm run dev
```

В терминале появится QR-код — отсканируйте его через WhatsApp:  
**Настройки → Связанные устройства → Привязать устройство**

После успешного подключения агент начнёт автоматически обрабатывать входящие сообщения от поставщиков.

---

## Структура проекта

```
src/
  index.ts              ← точка входа
  config/               ← переменные окружения
  whatsapp/             ← WhatsApp клиент, скачивание вложений
  parsers/              ← PDF / Word / Excel / OCR
  agent/                ← OpenAI GPT-4o, системный промпт, извлечение данных
  db/                   ← Supabase клиент + репозиторий (CRUD)
  queue/                ← BullMQ воркер, полный пайплайн обработки
  comparison/           ← алгоритм сравнения предложений
  reports/              ← генерация Excel и Word отчётов
supabase/
  migrations/           ← SQL схема БД
```

---

## Генерация отчётов

Отчёты создаются вручную через скрипт (будет добавлен в следующей версии).  
Сейчас данные накапливаются в таблице `offers` в Supabase — экспорт доступен через SQL Editor или Supabase Dashboard.

**Алгоритм сравнения поставщиков:**

| Критерий | Вес |
|---|---|
| Цена | 60% |
| Срок поставки | 25% |
| Условия оплаты | 15% |

---

## Схема базы данных

```
suppliers        — поставщики (телефон, имя, язык)
  └── messages   — история переписки (IN / OUT)
  └── documents  — вложения с результатом парсинга
  └── offers     — извлечённые предложения (цены, сроки, условия)
```

---

## Важные ограничения

- `whatsapp-web.js` требует постоянной Chromium-сессии — **не запускать в serverless-окружениях**
- Агент отвечает **только на входящие** сообщения от поставщиков (не рассылает спам)
- Фото низкого качества могут давать неточный OCR — такие данные помечаются в БД полем `ocr_confidence`

---

## Команды

```bash
npm run dev      # запуск в режиме разработки (с hot-reload)
npm run build    # компиляция TypeScript → dist/
npm start        # запуск скомпилированной версии
npm test         # юнит-тесты
```

---

## Лицензия

MIT
