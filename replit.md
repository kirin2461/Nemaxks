# Nemaks - Коммуникационная платформа

## Обзор

Nemaks — современная реалтайм-платформа для общения (аналог Discord) с геймификацией, системой лицензий и AI-ассистентом.

## Технологии

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Go, Gin, GORM, PostgreSQL
- **Realtime**: WebSocket, WebRTC

## Порты

- Frontend: `5000`
- Backend: `8000`

## Запуск

```bash
# Backend
cd backend && go run .

# Frontend  
cd frontend && npm run dev -- --host 0.0.0.0 --port 5000
```

## Структура проекта

```
/backend          - Go API сервер
  /models*.go     - Модели данных
  /handlers*.go   - HTTP обработчики
  /middleware*.go - Middleware
  /main.go        - Точка входа

/frontend         - React приложение
  /src/pages      - Страницы
  /src/components - Компоненты
  /src/lib        - Утилиты и API
  /src/contexts   - React контексты
  /src/stores     - Zustand хранилища
```

## Ключевые функции

### Система лицензий
- Тарифы: Monthly (50₽), Quarterly (125₽), Yearly (600₽)
- Формат ключа: `NEMKS-XXXXX-XXXXX-XXXXX`
- Поток: `/welcome` → `/activate` → `/auth`

### Безопасность
- JWT с ротацией токенов
- 2FA (TOTP)
- E2E шифрование (X25519-XSalsa20-Poly1305)
- Антифрод система

### Геймификация
- Уровни и XP
- Достижения
- Валюта (Coins/Gems)
- Магазин
- Испытания и стрики

### Образовательные инструменты (Premium)
- **Тетради**: Математика, Физика, Химия, Биология, История, География, Литература, Конспекты, Подготовка к экзаменам
- **Доски**: Математическая, Физическая, Химическая, Brainstorming, Канбан, Презентационная, Коллаборативная
- **Редакторы**: Python IDE, JavaScript/Web, SQL Playground, C++/Java, Arduino, Jupyter, LaTeX, Markdown
- Планы доступа: free, edu_basic, edu_pro
- API: `/api/templates/educational`

### Администрирование
- Роли: user, moderator, admin, super_admin
- Super Admin панель: `/admin/super`

## API маршруты

- `/api/auth/*` - Аутентификация
- `/api/license/*` - Лицензии
- `/api/guilds/*` - Гильдии
- `/api/channels/*` - Каналы
- `/api/dm/*` - Личные сообщения
- `/api/fraud/*` - Антифрод (admin)
- `/api/admin/*` - Администрирование

## Документация

Полная документация: `DOCUMENTATION.md`

## Настройки пользователя

- Язык: Русский
- Стиль общения: Простой
