# COMMIT_NOTES — fix/backend (BE-1…BE-4)

## BE-1 (M3): шторм 401 «token is expired»

**Причина:** `accessTokenExpiry = 15 * time.Minute` (backend/jwt_enhanced.go).
Realtime-подключения (/ws, /wstunnel, /api/sse/events) открываются один раз с
токеном и не проходят refresh flow; каждые 15 минут клиент получал 401 и
штормил реконнектами с протухшим токеном.

**Решение (вариант «а» из SPEC):** TTL access token увеличен до **24 часов**
(`accessTokenExpiry = 24 * time.Hour`). Refresh flow (POST /api/auth/refresh,
`refreshTokenHandler`) проверен и работоспособен: rotation refresh-токена,
проверка активной сессии, отзыв старого токена — менять не потребовалось.
Существующие тесты не затронуты (константа используется только как TTL и
длительность blacklist-записей).

**Попутно исправлено (тоже давало 401):** `longPollHandler`,
`longPollSendHandler`, `connectionStatusHandler` читали из gin-контекста ключ
`"userID"` (string), который не выставляет никто — authMiddleware кладёт
`"user_id"` (float64). Long polling и /api/connection/status **всегда**
отвечали 401 даже с валидным токеном. Теперь используется
`getUserIDFromContext`.

## BE-2 (M1): «В сети: 0» и «Друзья: 4»

**«В сети: 0» — две причины:**
1. `getPlatformStatsHandler` считал online по `users.last_seen`, а эта колонка
   **нигде в коде не обновлялась** → 0 при любых активных сессиях.
2. Счётчик не учитывал живые realtime-подключения.

**Исправлено:**
- `enhancedAuthMiddleware` теперь обновляет `users.last_seen` при каждом
  аутентифицированном запросе (рядом с уже существующим обновлением
  `user_sessions.last_seen_at`).
- Новый `countOnlineUsers()` (backend/Placeholder.go): union пользователей с
  свежим `last_seen` (5 мин, портативный `time.Now().Add(...)` вместо
  Postgres-only `NOW() - INTERVAL`) + пользователи с активными
  WebSocket-подключениями (hub.clientsByUser) + SSE-подключениями
  (sseHub.byUser).

**«Друзья: 4» — причина:** `getFriendsHandler` при пустом списке друзей
возвращал JSON `null` (nil slice), а фронтенд (DashboardPage.tsx) трактовал
`null` как сбой и подставлял захардкоженный дефолт `setFriendsCount(4)`.
Никаких seed-данных друзей в БД нет (проверено: Friend создаётся только в
respondFriendRequestHandler при accept).

**Исправлено (backend-сторона):** пустой список теперь сериализуется как `[]`
(`result := make([]FriendInfo, 0)`). Дефолт `4` на фронте — зона FE-агента.

## BE-3 (B3, Security): JWT в query-параметре

Добавлена поддержка `Authorization: Bearer <token>` (приоритет над `?token=`):

- `/ws` и `/wstunnel` (backend/websocket.go): `bearerTokenFromHeader(c)`,
  fallback на `?token=`.
- `/api/sse/events` (backend/handlers_fallback.go): то же; query оставлен,
  т.к. браузерный EventSource не умеет заголовки (см. FE-7).
- `/api/poll/events`: заголовок уже принимался через authMiddleware; после
  фикса ключа контекста (см. BE-1) работает. Query для poll никогда не
  поддерживался и фронтом не используется — не добавлял (минимальный дифф).

Общий helper: `bearerTokenFromHeader` в backend/handlers_fallback.go.

## BE-4 (M5): редактирование сообщения

**Вывод: баг на бэкенде.** `PUT /api/messages/update/:message_id`
(`updateMessageHandler`, backend/handlers_messages.go) обновляет **только**
DirectMessage — для channel-сообщений возвращает 404. Роута редактирования
канальных сообщений в backend не было.

**Исправлено:** добавлен роут
`PUT /api/channels/:channel_id/messages/:message_id` →
`updateChannelMessageHandler` (backend/handlers_channel_threads.go):
- только автор сообщения (`author_id = uid`, иначе 404 — IDOR-защита);
- сообщение должно принадлежать каналу из URL;
- content filter + SanitizeMessageContent (как в create/update DM);
- выставляется `edited=true`, `updated_at`;
- ответ — `channelMessageResponse` (тот же формат, что GET messages);
- broadcast `channel-message-edited` в WS-хаб.

Фронтенд-агенту: направить редактирование канальных сообщений на этот
эндпоинт; для DM остаётся `PUT /api/messages/update/:message_id`.

## Риски при сборке

- Go в песочнице нет — компиляция не проверялась, синтаксис проверен вручную.
- Новых импортов: `strings` в handlers_fallback.go (используется в
  bearerTokenFromHeader). Остальные файлы используют уже импортированные
  пакеты.
- Новых зависимостей нет, схема БД не менялась (колонки `last_seen`,
  `edited`, `updated_at` уже существуют).
- `hub.broadcast <-` в updateChannelMessageHandler — тот же паттерн, что в
  createChannelMessageHandler.
