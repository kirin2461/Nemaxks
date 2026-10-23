<div align="center">

# 🌌 Nebula

> Ребрендинг: ранее проект назывался **Nemaxks**.

### Современная коммуникационная платформа в стиле Discord

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-67.4%25-blue)](https://github.com/kirin2461/Nemaxks)
[![Go](https://img.shields.io/badge/Go-23.5%25-00ADD8)](https://github.com/kirin2461/Nemaxks)
[![Rust](https://img.shields.io/badge/Rust-2.3%25-orange)](https://github.com/kirin2461/Nemaxks)

*Self-hosted платформа для общения с полным набором функций: обмен сообщениями в реальном времени, голосовые/видеозвонки и инструменты модерации*

[Возможности](#-возможности) • [Установка](#-установка) • [Документация](#-документация) • [Дорожная карта](#-дорожная-карта) • [Участие в разработке](#-участие-в-разработке)

**Проприетарное ПО — все права защищены.** Исходный код опубликован только для просмотра и аудита (см. [LICENSE](./LICENSE)).

**[English version](README.md)**

</div>

---

## 💫 Живое демо

**https://82.114.226.204.sslip.io** — production (VDSina, Docker Compose, Caddy TLS)

---

## 📖 О проекте

**Nebula** — это комплексная коммуникационная платформа в стиле Discord, созданная для команд, сообществ и организаций, которым важны серверная модерация и административный контроль. Построенная на современных технологиях и микросервисной архитектуре, Nebula предоставляет:

- **Обмен сообщениями в реальном времени** на базе WebSocket
- **Голосовые и видеозвонки** на базе WebRTC/LiveKit
- **Сообщества на базе гильдий** с каналами и ролями
- **Продвинутые инструменты модерации**, включая аудит-логирование и хранение контента
- **Микросервисную архитектуру** с Go-бэкендом и Rust-сервисами для масштабируемости

### Почему Nebula?

В отличие от платформ со сквозным шифрованием, Nebula намеренно поддерживает серверную модерацию и административный доступ с полными аудит-следами. Это делает её идеальной для:

- Организаций, которым требуется контроль контента и соответствие требованиям (compliance)
- Сообществ, нуждающихся в мощных возможностях модерации
- Образовательных учреждений с требованиями безопасности
- Команд, которым нужны архивация и поиск по перепискам

---

## 📑 Содержание

- [Возможности](#-возможности)
- [Технологический стек](#-технологический-стек)
- [Установка](#-установка)
  - [Быстрый старт (локально)](#быстрый-старт-локально)
  - [Развёртывание в Docker](#развёртывание-в-docker)
  - [Ручная установка](#ручная-установка)
- [Структура проекта](#-структура-проекта)
- [Конфигурация](#-конфигурация)
- [Разработка](#-разработка)
- [Тестирование](#-тестирование)
- [Дорожная карта](#-дорожная-карта)
- [Документация](#-документация)
- [FAQ](#-faq)
- [Участие в разработке](#-участие-в-разработке)
- [Лицензия](#-лицензия)
- [Автор](#-автор)

---

## ✨ Возможности

### Основной функционал

- 💬 **Обмен сообщениями в реальном времени**: мгновенные сообщения на базе WebSocket с индикаторами набора текста
- 🎙️ **Голосовые и видеозвонки**: интеграция WebRTC/LiveKit для высококачественных звонков
- 🏰 **Система гильдий**: создавайте сообщества с множеством каналов и категорий
- 👥 **Управление пользователями**: регистрация, аутентификация и настройка профиля
- 📎 **Обмен файлами**: загрузка и отправка файлов в переписках
- 🔔 **Уведомления**: push-уведомления в реальном времени об упоминаниях и сообщениях

### Продвинутые возможности

- 🛡️ **Role-Based Access Control (RBAC)**: система тонко настраиваемых разрешений
- 🔨 **Инструменты модерации**: бан, мут, теневой бан (shadowban) и управление контентом
- 📊 **Аудит-логирование**: полный аудит-след с хранением 45 дней
- 🔍 **Поиск и экспорт**: полнотекстовый поиск и экспорт переписок
- 🤖 **Интеграция JARVIS**: возможности голосового ассистента
- 🔄 **gRPC-микросервисы**: масштабируемые Rust-сервисы аудита и поиска

### Безопасность и приватность

- 🔐 **JWT-аутентификация**: безопасная аутентификация на токенах
- 🚫 **Серверная модерация**: контроль контента с аудит-следами
- 🔒 **Ролевые разрешения**: гранулярный контроль доступа в каждой гильдии
- 📝 **Хранение аудита**: 45-дневная история сообщений и действий

---

## 🛠️ Технологический стек

### Backend

- **Go 1.24** — основной API-сервер
- **Gin** — HTTP веб-фреймворк
- **GORM** — ORM для работы с базой данных
- **PostgreSQL 15** — основная база данных
- **Redis 7** — кэширование и pub/sub
- **WebSocket** (gorilla/websocket) — коммуникация в реальном времени
- **gRPC** — межсервисное взаимодействие
- **JWT** — токены аутентификации

### Frontend

- **React 18** — UI-библиотека
- **TypeScript 5.6** — типизированный JavaScript
- **Vite 6** — сборщик и dev-сервер
- **Tailwind CSS 3.4** — utility-first CSS-фреймворк
- **Wouter** — легковесная маршрутизация
- **Zustand** — управление состоянием
- **TanStack Query** — получение и кэширование данных
- **Socket.IO Client** — коммуникация в реальном времени
- **Framer Motion** — библиотека анимаций
- **React Hook Form + Zod** — работа с формами и валидация

### Микросервисы (Rust)

- **Rust** — высокопроизводительные микросервисы
- **Tonic** — gRPC-фреймворк
- **Tokio** — асинхронный рантайм
- **Audit Service** — логирование событий и compliance
- **Search Service** — полнотекстовый поиск

### Инфраструктура

- **Docker & Docker Compose** — контейнеризация
- **LiveKit** — инфраструктура голоса/видео
- **Envoy** — API-шлюз (опционально)
- **Protocol Buffers** — сервисные контракты

---

## 🚀 Установка

### Требования

- **Go** 1.24+
- **Node.js** 18+ и npm/yarn
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** (опционально, для контейнерного развёртывания)
- **Rust** (опционально, для сборки микросервисов)

### Быстрый старт (локально)

1. **Клонируйте репозиторий**

```bash
# jarvis/ — git submodule, поэтому нужен --recurse-submodules
git clone --recurse-submodules https://github.com/kirin2461/Nemaxks.git
cd 654911

# Если уже склонировали без submodules:
git submodule update --init --recursive
```

2. **Настройте окружение**

```bash
cp .env.example .env
# Отредактируйте .env под вашу конфигурацию
```

Обязательные переменные:
```env
DATABASE_URL=postgres://nemaks_user:nemaks_password@localhost:5432/nemaks
REDIS_URL=redis://localhost:6379
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

3. **Запустите сервисы**

**На Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

**На Windows:**
```bash
start.bat
```

**Или используйте скрипт быстрого старта:**
```bash
# Windows
quick-start.bat

# Linux/macOS
chmod +x start.sh && ./start.sh
```

4. **Установите и запустите frontend**

```bash
cd frontend
npm install
npm run dev
```

Приложение будет доступно по адресам:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080` (или как настроено)

### Развёртывание в Docker

Для полной контейнерной установки:

```bash
cp .env.example .env
# Обязательно задайте POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET в .env
docker compose up -d --build
```

Будут запущены:
- База данных PostgreSQL (порт 5432, пароль обязателен — `${POSTGRES_PASSWORD:?required}`)
- Кэш Redis (порт 6379, `--requirepass ${REDIS_PASSWORD}`)
- Сервер голоса/видео LiveKit (порты 7880/7881/7882, конфиг — `livekit.yaml`)
- Go backend API (порт 8000)
- Production-сборка frontend за nginx (порт 5173)

Dev-frontend (vite dev server с hot reload, порт 5174):

```bash
docker compose --profile dev up -d
```

> **Rust-сервисы (audit/search) НЕ входят в корневой docker-compose.yml.**
> Они собираются отдельно: `docker compose -f rust-services/docker-compose.yml build`
> (build context — корень репозитория, нужен каталог `proto/`).
> Статус — experimental, см. ниже.

### gRPC (experimental)

gRPC-транспорт (`envoy.yaml`, `backend/grpc_server.go`, `backend/grpc_clients.go`,
`backend/proto/`, `rust-services/`) в данный момент **не активен**:
gRPC-сервер нигде не запускается, `backend/proto/*.pb.go` — рукописные
заглушки. Вся функциональность доступна по HTTP/WebSocket API Go-бэкенда.
Файлы оставлены как заготовка на будущее.

### Скрипты запуска (legacy) и Makefile

Рекомендуемый способ — Makefile (`make build`, `make test`, `make docker-up`,
`make docker-down`, `make help`). Legacy-скрипты в корне сохранены для
совместимости:

| Скрипт | Назначение |
|---|---|
| `start.sh` / `start.bat` | Запуск backend + frontend для локальной разработки |
| `stop.sh` / `stop.bat` | Остановка запущенных процессов |
| `quick-start.bat` | Быстрый старт (Windows) |
| `start-backend.bat` / `RUN.bat` / `install-backend.bat` | Запуск/установка только backend (Windows) |
| `validate.sh` / `validate.bat` | Валидация изменений (проверки сборки) |

### Ручная установка

#### Backend

```bash
cd backend
go mod download
go build -o nemaks-server
./nemaks-server
```

#### Frontend

```bash
cd frontend
npm install
npm run build
npm run preview
```

#### Rust-сервисы (опционально)

```bash
cd rust-services
cargo build --release

# Запуск audit-сервиса
cd audit-service
cargo run --release

# Запуск search-сервиса (в другом терминале)
cd search-service
cargo run --release
```

---

## 🗄️ Миграции базы данных

Сейчас схема БД управляется **GORM AutoMigrate** при старте backend. Вызовы
разбросаны по нескольким местам инициализации:

- `backend/handlers.go` (`initDB`) — базовые модели;
- `backend/handlers_phase1.go`, `handlers_phase2.go`, `handlers_phase3.go` — фазовые модули;
- `backend/models_fraud.go`, `backend/models_license.go` — модели fraud/license.

Ограничения подхода: нет версионирования и истории изменений схемы; нет отката
(rollback) и повторяемости между окружениями; AutoMigrate не удаляет колонки/индексы
и молча расходится с реальной схемой; параллельный старт нескольких инстансов
может гонять DDL без блокировок; сложно ревьюить изменения схемы в PR.

Рекомендуемый план перехода на [golang-migrate](https://github.com/golang-migrate/migrate)
(пока не реализовано):

1. Сгенерировать baseline-миграцию из текущей схемы (`pg_dump --schema-only`).
2. Добавить `migrations/` с up/down SQL-файлами и CLI `migrate` в CI.
3. Запуск миграций — отдельным шагом деплоя (init-контейнер/job), а не в коде приложения.
4. Отключить AutoMigrate после подтверждения parity схемы на staging.
5. Правило: любые изменения моделей GORM сопровождаются новой миграцией.

---

## 📁 Структура проекта

```
654911/
├── backend/                 # Go backend server
│   ├── cmd/                # Entry points
│   ├── internal/           # Private application code
│   │   ├── api/           # HTTP handlers
│   │   ├── auth/          # Authentication logic
│   │   ├── db/            # Database models
│   │   ├── middleware/    # HTTP middleware
│   │   └── websocket/     # WebSocket handlers
│   ├── pkg/               # Public libraries
│   └── go.mod
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── stores/        # Zustand state stores
│   │   ├── lib/           # Utilities
│   │   └── App.tsx        # Main app component
│   ├── public/            # Static assets
│   └── package.json
│
├── rust-services/          # Rust microservices workspace
│   ├── audit-service/     # Audit logging service
│   ├── search-service/    # Full-text search service
│   └── Cargo.toml         # Workspace manifest
│
├── proto/                  # Protocol Buffer definitions
│   ├── audit.proto        # Audit service contract
│   └── search.proto       # Search service contract
│
├── jarvis/                 # JARVIS voice assistant
├── jsvoice/                # Voice processing
├── docs/                   # Additional documentation
├── attached_assets/        # Static resources
│
├── docker-compose.yml      # Docker orchestration
├── envoy.yaml             # Envoy proxy config
├── livekit.yaml           # LiveKit configuration
├── Makefile               # Build automation
├── .env.example           # Environment template
└── README.md              # This file
```

---

## ⚙️ Конфигурация

### Переменные окружения

Создайте файл `.env` на основе `.env.example`:

| Переменная | Описание | Значение по умолчанию |
|----------|-------------|----------|
| `DATABASE_URL` | Строка подключения PostgreSQL | `postgres://nemaks_user:nemaks_password@localhost:5432/nemaks` |
| `REDIS_URL` | Строка подключения Redis | `redis://localhost:6379` |
| `LIVEKIT_URL` | URL сервера LiveKit | `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | API-ключ LiveKit | `devkey` |
| `LIVEKIT_API_SECRET` | API-секрет LiveKit | `secret` |
| `AUDIT_SERVICE_URL` | gRPC-эндпоинт audit-сервиса | `localhost:50051` |
| `SEARCH_SERVICE_URL` | gRPC-эндпоинт search-сервиса | `localhost:50052` |
| `ENABLE_RUST_SERVICES` | Включить Rust-микросервисы | `true` |

### Конфигурация LiveKit

Отредактируйте `livekit.yaml` для настройки WebRTC:

```yaml
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000
```

---

## 💻 Разработка

### Разработка frontend

```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Разработка backend

```bash
cd backend
go run cmd/server/main.go  # Run development server
go test ./...              # Run tests
go build                   # Build binary
```

### Стиль кода

- **Frontend**: ESLint + TypeScript strict mode
- **Backend**: Go fmt + Go vet
- **Rust**: Cargo fmt + Cargo clippy

Подробные правила см. в [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 🧪 Тестирование

### Тесты backend

```bash
cd backend
go test ./... -v
go test -cover ./...
```

### Тесты frontend

```bash
cd frontend
npm run test
```

### Скрипты валидации

```bash
# Windows
validate.bat

# Linux/macOS
chmod +x validate.sh
./validate.sh
```

---

## 🗺️ Дорожная карта

### ✅ Фаза A — Качество репозитория (завершена)
- Документация и правила участия в разработке
- CI/CD-проверки
- Политики безопасности

### 🔄 Фаза B — RBAC и модерация (в работе)
- Роли и разрешения в стиле Discord
- Модераторы в рамках гильдий
- Глобальные роли admin/super-admin
- Функционал бана/мута/теневого бана
- Процесс одобрения доступа к ЛС
- Аудит-логирование с хранением 45 дней
- Поиск и экспорт

### 📋 Фаза C — Интеграция Rust-сервисов
- Полный end-to-end Rust-сервисов (БД + кэш + gRPC + Go-клиент)
- Оптимизация производительности
- Интеграция service mesh

### 📞 Фаза D — Улучшенные звонки
- Конференции с 3+ участниками
- Демонстрация экрана
- Запись звонков
- История звонков и аналитика

### 🤝 Фаза E — Совместная работа
- Интеграция CRDT для совместного редактирования
- Офлайн-режим с синхронизацией
- Снимки документов
- Совместное редактирование в реальном времени

Подробный таймлайн см. в [ROADMAP.md](./ROADMAP.md).

---

## 📚 Документация

Доступна дополнительная документация:

- [**CONTRIBUTING.md**](./CONTRIBUTING.md) — правила и процесс участия в разработке
- [**SECURITY.md**](./SECURITY.md) — политики безопасности и сообщение об уязвимостях
- [**GRPC_SETUP.md**](./GRPC_SETUP.md) — настройка и интеграция gRPC-сервисов
- [**AI_INTEGRATION_GUIDE.md**](./AI_INTEGRATION_GUIDE.md) — интеграция AI-функций
- [**JARVIS_INTEGRATION_SETUP.md**](./JARVIS_INTEGRATION_SETUP.md) — настройка ассистента JARVIS
- [**JARVIS_COMMAND_CONTRACT.md**](./JARVIS_COMMAND_CONTRACT.md) — спецификация голосовых команд
- [**JARVIS_TESTING_GUIDE.md**](./JARVIS_TESTING_GUIDE.md) — тестирование голосовых функций
- [**REDIS_LIVEKIT_SETUP.md**](./REDIS_LIVEKIT_SETUP.md) — настройка realtime-инфраструктуры
- [**PHASE5_FINAL_INTEGRATION.md**](./PHASE5_FINAL_INTEGRATION.md) — руководство по финальной интеграции

---

### 🔒 Экран «О программе / Лицензия»

Nebula — проприетарное ПО с лицензией All Rights Reserved: исходный код доступен только для просмотра и аудита; любое использование, копирование, модификация или распространение требуют явного письменного разрешения владельца (см. [`LICENSE`](./LICENSE)).

Чтобы правила лицензирования и брендинга были явно видны внутри UI, рекомендуется добавить отдельный экран **«О программе / Лицензия»** во frontend:

- Показывает название проекта и краткое описание Nebula.
- Отображает сводку проприетарной лицензии со ссылкой на полный файл [`LICENSE`](./LICENSE).
- Объясняет правила **брендинга и атрибуции** (использование названия и логотипа Nebula, требование помечать неофициальные форки и т.д.).
- Подчёркивает проектные решения по безопасности и модерации (нет E2E-шифрования by design, серверное аудит-логирование, RBAC).

Готовый React + TypeScript + Tailwind компонент для этого экрана можно реализовать в `src/pages/AboutPage.tsx` и смонтировать на маршруте `/about` через Wouter. Ссылку вида **«О программе / Лицензия»** затем можно разместить в футере или меню пользователя, чтобы пользователи размещённых инстансов всегда видели информацию о лицензии и брендинге изнутри приложения.

---

## ❓ FAQ

### Почему нет сквозного (end-to-end) шифрования?

Nebula намеренно не реализует E2E-шифрование, чтобы обеспечить:
- Серверную модерацию контента
- Административный контроль с аудит-следами
- Соответствие политикам организаций
- Полнотекстовый поиск по всему контенту
- Хранение и архивацию сообщений

Это делает платформу подходящей для организаций, которым важен контроль контента, а не приватность-first обмен сообщениями.

### Можно ли развернуть Nebula в production?

Да, но, пожалуйста:
- Изучите [SECURITY.md](./SECURITY.md) с рекомендациями по безопасности
- Настройте резервное копирование базы данных
- Настройте SSL/TLS-сертификаты
- Используйте стойкие учётные данные
- Включите мониторинг и логирование

Учтите: production-использование требует письменного разрешения владельца (см. [LICENSE](./LICENSE)).

### Как включить Rust-микросервисы?

Установите `ENABLE_RUST_SERVICES=true` в файле `.env` и убедитесь, что сервисы запущены:

```bash
cd rust-services
cargo build --release
# Затем запустите каждый сервис отдельно или через Docker
```

### Чем проект отличается от Discord?

Nebula — это:
- **Source-available** — полный контроль над вашими данными и развёртыванием (проприетарная лицензия, см. [LICENSE](./LICENSE))
- **Self-hosted** — работа на собственной инфраструктуре
- **Модерация-first** — создана для организаций, которым нужен контроль
- **Кастомизируемая** — модифицируйте и расширяйте под свои задачи (с разрешения владельца)
- **Готова к микросервисам** — масштабируйте отдельные компоненты независимо

### Могу ли я поучаствовать в разработке?

Конечно! Пожалуйста, прочитайте [CONTRIBUTING.md](./CONTRIBUTING.md). Мы приветствуем:
- Отчёты об ошибках и исправления
- Реализацию новых функций
- Улучшения документации
- Оптимизации производительности
- Улучшения UI/UX

---

## ✅ QA Status (2026-10-24)

Пройдено 12 этапов независимого QA (AI-agent: браузер + API + серверные логи + статический аудит):

| Этап | Скоуп | Результат |
|---|---|---|
| 1-7 | Функционал, i18n, realtime, модерация, контент-фильтр | Все баги исправлены (кроме Jarvis — по требованию владельца) |
| 8 | Архитектурные UI-баги: роутинг, дубли UI, синхронизация состояния, REST-спам | 7 багов найдено и исправлено: idempotency (double-post, дубли каналов), display_name E2E, затенённый маршрут /profile/customize, бейджи непрочитанного, WS stale closure, backoff поллинга |
| 9 | Загрузка файлов: лимиты (50MB медиа / 500MB видео), асинхронность, мультизагрузка x12, обрыв сети | PASS; исправлен критичный nginx-баг недоступности /uploads |
| 10 | Инструменты канала (Доска/Блокнот) + real-time collab-редактор | Исправлено: молчаливый 403 пейволла (toast с тарифом), недостижимый тариф Premium (data-фикс tier), фильтрация списка по вкладкам. Collab: CRDT LWW, avg 11.7ms, reconnect без потерь, presence с курсорами — PASS |
| 11 | Харднинг collab-бэкенда (по рискам этапа 10) | Закрыта уязвимость доступа: WS/REST collab-эндпоинты теперь проверяют права на канал (WS close 4403/4404, REST 403/404 — эксплойт воспроизводился до фикса, после — отклонён). Сессии per-connection (гонка reconnect устранена), WS ping/pong keepalive (30s/70s), сериализация CRDT-merge per-tool (устранён lost update при одновременной записи). Регрессия C1–C4: PASS |
| 12 | Трёхуровневая синхронизация: WS → SSE → NSP (long_polling вырезан) + рубильник суперадмина с SPA-подписью | Backend: scoped SSE `GET /api/sse/collab/:channel_id/:tool_id` для collab (JWT header или ?token=, те же R1 access-проверки 403/404, heartbeat 15s), collabSSEHub дублирует BroadcastOps/Cursor/State (cursor-эхо автору не уходит); починен глобальный WriteTimeout 15s, убивавший любой SSE-поток на 15-й секунде (0a67206). Frontend: long_polling удалён; connectionManager websocket → wstunnel → sse; ToolEditorPage после 2 неудачных WS-reconnect открывает EventSource для входящих (общий handleWsMessage, эхо своих ops идемпотентно по lamport), handover SSE→WS при восстановлении. Рубильник суперадмина (SuperAdminPage → «Синхронизация», 68b3042, ae714f7): тумблеры транспортов ws/wstunnel/sse/nsp со счётчиками активных соединений + аварийный kill switch (подтверждение вводом «ОТКЛЮЧИТЬ», баннер «Realtime отключён»); enforcement мгновенный — force-close уже активных соединений (WS close 4503 «transport disabled» / 4600 «kill switch active», SSE-стримы обрываются, collab-запись /api/collab/sync → 503 при kill_all, обычный REST read-only жив); каждое движение рубильника пишется в аудит (sync_transport_audit, changed_by). NSP v2.1 «RU-Lite» — собственный третий транспорт синхронизации поверх dual-HTTPS chunked (backend 606d629 + web-клиент 5194208): бинарный фрейминг (prefix FA5A + varint length + CRC32 IEEE), POST /api/nsp/v2/up full-duplex с батч-фолбэком POST /send (Safari), GET /down, сессии с RESUME по session_id+last_recv_seq (ring buffer 100 фреймов/60s), идемпотентность по op_id, heartbeat PING 30s / PONG-timeout 75s, детерминированные ERROR-коды (4005 session_expired → re-handshake, 4006 buffer_overflow → STATE full-sync); клиентская fallback-цепочка WS → wstunnel → SSE → NSP → offline queue (localStorage). SPA-подпись kill switch (223c805, NSP spec §6): Ed25519 (WebCrypto, приватный ключ не покидает IndexedDB), key_id=BLAKE2b-64(pubkey), одноразовый nonce (anti-replay, TTL 5 мин), окно ±60s; после регистрации первого ключа kill_all требует подписи в обе стороны (угнанный JWT не выключит защиту), аудит хранит spa_key_id. Тесты: T1–T6, K1–K9 PASS (SSE heartbeat/доставка, R1-негативы, RBAC 403, изоляция транспортов, force-close ≤3s); 19/19 backend IT NSP (handshake/resume/replay/лимиты/рубильник); 14/14 web E2E (кодек, WS-op → OPS_BCAST, OPS → ACK, обрыв down → resume без дублей, heartbeat); 12/12 SPA (S1–S6: backward compat, spa_required/invalid/expired/replay, аудит со spa_key_id); регрессия C1–C4 PASS |

Последний QA-коммит: `223c805` (main). Этап 12 завершён: NSP-транспорт с fallback-цепочкой WS → wstunnel → SSE → NSP и SPA-подпись kill switch покрыты интеграционными тестами (19/19 backend IT, 14/14 web E2E, 12/12 SPA).

---

## 🤝 Участие в разработке

Мы приветствуем вклад в проект! Подробности в [Contributing Guidelines](./CONTRIBUTING.md):

- Кодекс поведения
- Процесс разработки
- Стандарты кодирования
- Процесс Pull Request
- Отчёты о проблемах

### Быстрые шаги для контрибьюции

1. Сделайте форк репозитория
2. Создайте ветку функции (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📄 Лицензия

**Проприетарная — все права защищены.** Copyright (c) 2026 kirin2461. Исходный код опубликован только для просмотра и аудита. Копирование, модификация, распространение, коммерческое или production-использование без явного письменного разрешения владельца запрещены. См. [LICENSE](./LICENSE).

---

## 👤 Автор

**kirin2461**

- GitHub: [@kirin2461](https://github.com/kirin2461)
- Репозиторий: [github.com/kirin2461/654911](https://github.com/kirin2461/Nemaxks)

---

## 🌟 Благодарности

- Создано под вдохновением от коммуникационной модели Discord
- Работает на великолепных open-source технологиях
- Спасибо всем контрибьюторам и сообществу

---

## 📞 Поддержка

По вопросам, проблемам и обсуждениям:

- 🐛 [Сообщить об ошибке](https://github.com/kirin2461/Nemaxks/issues)
- 💡 [Предложить функцию](https://github.com/kirin2461/Nemaxks/issues)
- 💬 [Начать обсуждение](https://github.com/kirin2461/Nemaxks/discussions)

---

<div align="center">

**⭐ Если проект оказался полезным — поставьте звезду! ⭐**

[⬆ Наверх](#-nebula)

</div>
