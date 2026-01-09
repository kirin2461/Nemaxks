# 💳 Subscription & Billing System for Nemaxks

## Обзор

Система подписок и биллинга для учебных организаций (вузы/частные курсы) с доступом по лицензии и приглашениям. Использует стандартную OIDC/JWT аутентификацию через Keycloak, а бизнес-права и подписки управляются на стороне приложения.

## 🎯 Ключевые принципы

- **Аутентификация**: OIDC/JWT через Keycloak (стандартный логин)
- **Авторизация**: На стороне приложения (динамические права по каналам)
- **Биллинг**: Оплата за "billable seats" (платные роли), а не за всех участников
- **Хранение**: Базовые лимиты + платный overage 50 ₽/ГБ‑мес
- **Оплата**: YooKassa (рекуррент) + прямой перевод на карту

---

## 📊 Уровни подписки

### Free (без подписки организации)

**Доступ**:
- Только по инвайту в канал
- Роль по умолчанию: `read-only` (не billable)

**Хранение**:
- Видео: 7 дней
- Сообщения: 30 дней
- Посты: автоудаление через 15 дней
- Логи: 45 дней
- Доски/тетради: не сохраняются после закрытия сессии

**Jarvis**:
- До 3 запросов/день бесплатно
- Дальше недоступно

**Overage**:
- Продление хранения сверх сроков недоступно

**Цена**: 0 ₽

---

### Edu Basic (для курсов/малых групп)

**Доступ**:
- Организация может создавать спец-каналы
- Базовые учебные шаблоны и доски
- Проверка прав через `org_entitlement` на сервере

**Биллинг seats**:
- `student_editor`: **35 ₽/мес** (billable)
- `staff_seat`: **500 ₽/мес** (billable)
- `reader`: бесплатно (non-billable)

**Хранение**:
- Видео: 14 дней
- Сообщения: 60 дней
- Логи: 45 дней
- Доски/тетради: до 30 дней (потом архивируются/удаляются)

**Jarvis**:
- 10 запросов/день на организацию
- Сверх лимита: недоступно или покупка пакетов

**Overage**:
- Хранение сверх лимитов: **50 ₽/ГБ‑мес**
- Активируется флагом `keep_beyond_retention`

**Базовая цена**: 0 ₽ фикс + оплата по seats и overage

---

### Edu Pro (основной платный)

**Доступ**:
- Расширенные учебные фичи
- **Сохраняемые** интерактивные доски и онлайн-тетради (`boards_persist=true`)
- Продвинутые шаблоны
- Экспорт материалов

**Биллинг seats**:
- `student_editor`: **35 ₽/мес** (billable)
- `staff_seat`: **500 ₽/мес** (billable)
- `reader`: бесплатно (non-billable)

**Хранение**:
- Видео: 60 дней
- Сообщения: 180 дней
- Логи: 90 дней
- Доски/тетради: **постоянно** (пока активна подписка)

**Jarvis**:
- 50 запросов/день на организацию
- Дополнительные пакеты можно купить

**Overage**:
- Хранение сверх лимитов: **50 ₽/ГБ‑мес**
- Для многолетнего хранения видео/сообщений

**Отслеживание трафика**:
- Отчёты по usage из корпоративных подсетей/VPN
- Для админов организации

**Базовая цена**: **2000 ₽/мес** за организацию + переменная часть

---

## 🎁 Поддержать автора

**Механика**:
- Добровольный донат **от 20 ₽**
- Доступен для любого пользователя (с аккаунтом или анонимно)
- Не даёт никаких прав или entitlements

**Оплата**:
- YooKassa: одноразовый платёж (не рекуррент)
- Прямой перевод на карту: ручная сверка

**UI**:
- Кнопка "Поддержать автора" на странице оплаты
- Форма ввода суммы (min 20 ₽)
- Быстрые кнопки: 20₽, 50₽, 100₽, 500₽
- После оплаты: спасибо-страница

---

## 🗄️ База данных

### Таблица `subscription_plan`

Основные планы подписок:

```sql
CREATE TABLE subscription_plan (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- 'free', 'edu_basic', 'edu_pro'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price_rub DECIMAL(10,2) DEFAULT 0,
  
  -- Retention limits
  video_retention_days INT DEFAULT 7,
  messages_retention_days INT DEFAULT 30,
  posts_retention_days INT DEFAULT 15,
  logs_retention_days INT DEFAULT 45,
  
  -- Features
  boards_persist_flag BOOLEAN DEFAULT FALSE,
  jarvis_daily_limit INT DEFAULT 3,
  overage_storage_enabled BOOLEAN DEFAULT FALSE,
  traffic_reports_enabled BOOLEAN DEFAULT FALSE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Пример данных
INSERT INTO subscription_plan (slug, name, base_price_rub, video_retention_days, messages_retention_days, boards_persist_flag, jarvis_daily_limit, overage_storage_enabled) VALUES
('free', 'Free', 0, 7, 30, FALSE, 3, FALSE),
('edu_basic', 'Edu Basic', 0, 14, 60, FALSE, 10, TRUE),
('edu_pro', 'Edu Pro', 2000, 60, 180, TRUE, 50, TRUE);
```

### Таблица `seat_pricing`

Цены на billable роли:

```sql
CREATE TABLE seat_pricing (
  id SERIAL PRIMARY KEY,
  plan_id INT REFERENCES subscription_plan(id) ON DELETE CASCADE,
  seat_type VARCHAR(50) NOT NULL,  -- 'student_editor', 'staff', 'reader'
  price_per_month_rub DECIMAL(10,2) NOT NULL,
  min_seats INT DEFAULT 0,
  max_seats INT DEFAULT NULL,  -- NULL = no limit
  is_billable BOOLEAN DEFAULT TRUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_id, seat_type)
);

-- Пример данных для Edu Basic
INSERT INTO seat_pricing (plan_id, seat_type, price_per_month_rub, is_billable) VALUES
(2, 'student_editor', 35.00, TRUE),
(2, 'staff', 500.00, TRUE),
(2, 'reader', 0.00, FALSE);

-- Для Edu Pro
INSERT INTO seat_pricing (plan_id, seat_type, price_per_month_rub, is_billable) VALUES
(3, 'student_editor', 35.00, TRUE),
(3, 'staff', 500.00, TRUE),
(3, 'reader', 0.00, FALSE);
```

### Таблица `overage_pricing`

Цены на usage-метрики:

```sql
CREATE TABLE overage_pricing (
  id SERIAL PRIMARY KEY,
  plan_id INT REFERENCES subscription_plan(id) ON DELETE CASCADE,  -- NULL = global
  metric_type VARCHAR(50) NOT NULL,  -- 'storage_gb_month', 'jarvis_request_pack'
  price_rub DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,  -- 'GB·месяц', '50 запросов'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Пример данных
INSERT INTO overage_pricing (plan_id, metric_type, price_rub, unit, description) VALUES
(2, 'storage_gb_month', 50.00, 'GB·месяц', 'Хранение сверх лимита плана'),
(3, 'storage_gb_month', 50.00, 'GB·месяц', 'Хранение сверх лимита плана'),
(3, 'jarvis_request_pack', 100.00, '50 запросов', 'Пакет запросов Jarvis');
```

### Таблица `org` (учебная организация)

```sql
CREATE TABLE org (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'suspended', 'deleted'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `org_subscription`

```sql
CREATE TABLE org_subscription (
  id SERIAL PRIMARY KEY,
  org_id INT REFERENCES org(id) ON DELETE CASCADE,
  plan_id INT REFERENCES subscription_plan(id),
  
  -- Seats count
  seats_student_editor INT DEFAULT 0,
  seats_staff INT DEFAULT 0,
  
  -- Period
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  grace_until TIMESTAMP,  -- Grace period after expiry
  
  -- Billing
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_provider VARCHAR(50),  -- 'yookassa', 'manual_transfer'
  billing_period VARCHAR(20) DEFAULT 'monthly',  -- 'monthly', 'annual'
  
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `org_entitlement`

```sql
CREATE TABLE org_entitlement (
  id SERIAL PRIMARY KEY,
  org_id INT REFERENCES org(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,  -- 'boards_persist', 'traffic_reports'
  enabled BOOLEAN DEFAULT TRUE,
  limits_json JSONB,  -- {"retention_days": 180, "jarvis_free_requests_per_day": 50}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, feature_key)
);
```

### Таблица `storage_overage_daily`

```sql
CREATE TABLE storage_overage_daily (
  id SERIAL PRIMARY KEY,
  org_id INT REFERENCES org(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bytes_over_retention BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, date)
);

-- В конце месяца: конвертация в ГБ-мес и добавление в счёт
```

### Таблица `donation_settings`

```sql
CREATE TABLE donation_settings (
  id SERIAL PRIMARY KEY,
  min_amount_rub DECIMAL(10,2) DEFAULT 20.00,
  default_amounts_json JSONB DEFAULT '[20, 50, 100, 500]',
  thank_you_message TEXT DEFAULT 'Спасибо за поддержку!',
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO donation_settings (id) VALUES (1);  -- Singleton
```

### Таблица `donation`

```sql
CREATE TABLE donation (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,  -- Nullable for anonymous
  amount_rub DECIMAL(10,2) NOT NULL,
  payment_provider VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'paid', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `pricing_change_log`

Аудит изменений цен:

```sql
CREATE TABLE pricing_change_log (
  id SERIAL PRIMARY KEY,
  changed_by_user_id INT REFERENCES users(id),
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Аутентификация и авторизация

### OIDC/JWT через Keycloak

**Keycloak** используется только как "шлюз" идентификации:
- Выдаёт ID token / access token
- Хранит базовую информацию о пользователях
- **НЕ** управляет бизнес-правами и подписками

**Приложение**:
- Проверяет JWT-токен
- Извлекает `user_id` (или `oidc_subject`)
- Загружает права из собственной БД: `org_member`, `channel_acl`, `org_entitlement`

### Пример проверки прав в Go

```go
// internal/auth/subscription.go
package auth

import (
	"context"
	"time"
)

type SubscriptionService struct {
	db *gorm.DB
}

func (s *SubscriptionService) CanAccessSpecialChannel(ctx context.Context, userID int, channelID int) (bool, error) {
	// 1. Получить канал
	var channel Channel
	if err := s.db.First(&channel, channelID).Error; err != nil {
		return false, err
	}
	
	// 2. Если канал не спец-канал, разрешить
	if channel.Type != "special" {
		return true, nil
	}
	
	// 3. Проверить подписку организации
	var sub OrgSubscription
	err := s.db.Where("org_id = ? AND status = 'active' AND ends_at > ?", channel.OrgID, time.Now()).First(&sub).Error
	if err != nil {
		return false, nil  // Нет активной подписки
	}
	
	// 4. Проверить entitlement на спец-каналы
	var ent OrgEntitlement
	err = s.db.Where("org_id = ? AND feature_key = 'special_channels' AND enabled = true", channel.OrgID).First(&ent).Error
	if err != nil {
		return false, nil
	}
	
	// 5. Проверить права пользователя в канале (ACL)
	var acl ChannelACL
	err = s.db.Where("channel_id = ? AND principal_type = 'user' AND principal_id = ?", channelID, userID).First(&acl).Error
	if err != nil {
		return false, nil  // Пользователь не имеет прав в канале
	}
	
	return true, nil
}
```

---

## 💰 Биллинг: Billable Seats

### Принцип

Платить только за **billable роли**:
- `student_editor`: 35 ₽/мес
- `staff`: 500 ₽/мес
- `reader`: 0 ₽ (не billable)

### Подсчёт billable seats

```go
// internal/billing/seats.go
package billing

import (
	"time"
)

type SeatBillingService struct {
	db *gorm.DB
}

func (s *SeatBillingService) CountBillableSeats(orgID int, period time.Time) (int, int, error) {
	// Считаем активных участников с billable ролями
	var studentCount, staffCount int64
	
	// Student editors
	err := s.db.Table("channel_acl").
		Joins("JOIN channels ON channels.id = channel_acl.channel_id").
		Where("channels.org_id = ? AND channel_acl.seat_type = 'student_editor' AND channel_acl.is_active = true", orgID).
		Distinct("channel_acl.principal_id").
		Count(&studentCount).Error
	if err != nil {
		return 0, 0, err
	}
	
	// Staff seats
	err = s.db.Table("org_member").
		Where("org_id = ? AND org_role IN ('admin', 'teacher', 'curator') AND state = 'active'", orgID).
		Count(&staffCount).Error
	if err != nil {
		return 0, 0, err
	}
	
	return int(studentCount), int(staffCount), nil
}

func (s *SeatBillingService) CalculateMonthlyCharge(orgID int, planID int) (float64, error) {
	// 1. Получить план
	var plan SubscriptionPlan
	if err := s.db.First(&plan, planID).Error; err != nil {
		return 0, err
	}
	
	// 2. Базовая цена плана
	total := float64(plan.BasePriceRub)
	
	// 3. Подсчёт billable seats
	studentCount, staffCount, err := s.CountBillableSeats(orgID, time.Now())
	if err != nil {
		return 0, err
	}
	
	// 4. Получить цены seats
	var prices []SeatPricing
	err = s.db.Where("plan_id = ? AND is_active = true", planID).Find(&prices).Error
	if err != nil {
		return 0, err
	}
	
	for _, p := range prices {
		switch p.SeatType {
		case "student_editor":
			total += float64(studentCount) * float64(p.PricePerMonthRub)
		case "staff":
			total += float64(staffCount) * float64(p.PricePerMonthRub)
		}
	}
	
	// 5. Добавить overage storage
	overageCharge, err := s.CalculateStorageOverage(orgID)
	if err == nil {
		total += overageCharge
	}
	
	return total, nil
}
```

---

## 📦 Overage Storage: 50 ₽/ГБ‑мес

### Принцип

Всё, что хранится **дольше** базовых сроков плана, тарифицируется:
- Метрика: `stored_gb_month` = средний объём (ГБ) × доля месяца
- Тариф: **50 ₽/ГБ‑мес**

### Пример расчёта

```go
// internal/billing/storage.go
package billing

import (
	"time"
)

func (s *SeatBillingService) CalculateStorageOverage(orgID int) (float64, error) {
	// Получить данные за месяц
	start := time.Now().AddDate(0, -1, 0)
	end := time.Now()
	
	var records []StorageOverageDaily
	err := s.db.Where("org_id = ? AND date BETWEEN ? AND ?", orgID, start, end).Find(&records).Error
	if err != nil {
		return 0, err
	}
	
	// Суммируем байты
	var totalBytes int64
	for _, r := range records {
		totalBytes += r.BytesOverRetention
	}
	
	// Конвертация в ГБ-мес
	gbMonth := float64(totalBytes) / (1024 * 1024 * 1024) / float64(len(records)) * 30.0
	
	// Получить цену overage
	var pricing OveragePricing
	err = s.db.Where("metric_type = 'storage_gb_month' AND is_active = true").First(&pricing).Error
	if err != nil {
		return 0, err
	}
	
	charge := gbMonth * float64(pricing.PriceRub)
	return charge, nil
}
```

### Политика хранения объектов

```go
// internal/storage/retention.go
package storage

import (
	"time"
)

type StorageObject struct {
	ID                 int
	OrgID              int
	Type               string    // 'video', 'message_attachment', 'board_state'
	CreatedAt          time.Time
	RetentionExpiresAt time.Time
	KeepBeyondRetention bool  // Флаг для overage storage
}

func (s *StorageService) ShouldDeleteObject(obj *StorageObject, plan *SubscriptionPlan) bool {
	// Если флаг keep_beyond_retention = true и есть активная подписка с overage
	if obj.KeepBeyondRetention {
		if plan.OverageStorageEnabled {
			return false  // Хранить (biллить за overage)
		}
	}
	
	// Иначе проверить истечение retention
	return time.Now().After(obj.RetentionExpiresAt)
}
```

---

## 💳 Оплата

### YooKassa (рекуррентные платежи)

Для автопродления подписок:

```go
// internal/payment/yookassa.go
package payment

import (
	"bytes"
	"encoding/json"
	"net/http"
)

type YooKassaService struct {
	ShopID    string
	SecretKey string
}

func (y *YooKassaService) CreateRecurringPayment(amount float64, description string, returnURL string) (string, error) {
	payload := map[string]interface{}{
		"amount": map[string]interface{}{
			"value":    amount,
			"currency": "RUB",
		},
		"confirmation": map[string]interface{}{
			"type":       "redirect",
			"return_url": returnURL,
		},
		"capture":     true,
		"description": description,
		"save_payment_method": true,  // Для рекуррента
	}
	
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.yookassa.ru/v3/payments", bytes.NewBuffer(body))
	req.SetBasicAuth(y.ShopID, y.SecretKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotence-Key", generateIdempotenceKey())
	
	// ... отправка запроса и обработка ответа
	return "payment_id", nil
}
```

### Прямой перевод на карту

Ручной flow:
1. Пользователь выбирает "Перевод на карту"
2. Показываются реквизиты (номер карты, ФИО)
3. Пользователь переводит деньги и вводит последние 4 цифры транзакции
4. Админ проверяет в банке и подтверждает платёж вручную
5. Подписка активируется

```go
// internal/payment/manual.go
package payment

type ManualTransferService struct {
	db *gorm.DB
}

func (m *ManualTransferService) CreateManualPayment(orgID int, amount float64, last4Digits string) error {
	payment := Payment{
		OrgID:           orgID,
		Amount:          amount,
		PaymentProvider: "manual_transfer",
		Status:          "pending_verification",
		Last4Digits:     last4Digits,
	}
	return m.db.Create(&payment).Error
}

func (m *ManualTransferService) ConfirmManualPayment(adminID int, paymentID int) error {
	// Админ подтверждает
	err := m.db.Model(&Payment{}).Where("id = ?", paymentID).Updates(map[string]interface{}{
		"status":          "paid",
		"verified_by":     adminID,
		"verified_at":     time.Now(),
	}).Error
	if err != nil {
		return err
	}
	
	// Активировать подписку
	// ...
	return nil
}
```

---

## 🖥️ UI: Панель супер-админа

### Раздел "Управление ценами"

**Маршрут**: `/admin/pricing`

**Требования**:
- Доступ только для `user.role = 'superadmin'`
- Все изменения логируются в `pricing_change_log`

#### Секция 1: Планы подписки

Таблица с редактируемыми полями:
- Название плана (Free/Edu Basic/Edu Pro)
- Базовая цена (₽/мес)
- Retention сроки (видео/сообщения/посты/логи)
- Лимиты Jarvis (запросов/день)
- Флаги (boards_persist, overage_enabled, traffic_reports)

**Действия**:
- Inline-редактирование
- Кнопка "Сохранить" → обновление БД + лог

#### Секция 2: Цены на роли (Seats)

Таблица сгруппирована по планам:
- План → Роль → Цена ₽/мес → Min/Max seats → Billable

**Действия**:
- Inline-редактирование цены
- Кнопка "Добавить новую роль" (для кастомных типов)

#### Секция 3: Overage-метрики

Таблица:
- План (или "Глобально") → Метрика → Цена ₽ → Единица

**Пример**:
- Хранение сверх лимита: **50** ₽ за GB·месяц
- Jarvis пакет: **100** ₽ за 50 запросов

#### Секция 4: Донаты

Настройки `donation_settings`:
- Минимальная сумма (₽)
- Быстрые кнопки (массив сумм)
- Сообщение "Спасибо"
- Включено/Выключено

---

## 📄 Frontend: Страница оплаты

### Компонент `SubscriptionPage.tsx`

**Маршрут**: `/subscription`

**Содержимое**:
1. **Сравнение планов** (Free / Edu Basic / Edu Pro)
   - Таблица с фичами и ценами
   - Кнопки "Купить" или "Текущий план"

2. **Калькулятор стоимости**
   - Выбор плана
   - Количество student_editor и staff seats
   - Автоматический расчёт: `базовая цена + (seats × цена)`
   - Примечание: "+ overage storage 50 ₽/ГБ‑мес при превышении лимитов"

3. **Форма оплаты**
   - Выбор способа: YooKassa / Прямой перевод
   - Если YooKassa: редирект на платёжную форму
   - Если перевод: показать реквизиты + поле для последних 4 цифр

4. **Кнопка "Поддержать автора"**
   - Форма ввода суммы (min 20 ₽)
   - Быстрые кнопки: 20₽, 50₽, 100₽, 500₽
   - После оплаты: спасибо-сообщение

### Пример компонента

```tsx
// frontend/src/pages/SubscriptionPage.tsx
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

const SubscriptionPage: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState('edu_basic');
  const [studentSeats, setStudentSeats] = useState(10);
  const [staffSeats, setStaffSeats] = useState(2);

  const calculateTotal = () => {
    const plans = {
      free: { base: 0, student: 0, staff: 0 },
      edu_basic: { base: 0, student: 35, staff: 500 },
      edu_pro: { base: 2000, student: 35, staff: 500 },
    };
    const plan = plans[selectedPlan];
    return plan.base + (studentSeats * plan.student) + (staffSeats * plan.staff);
  };

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, studentSeats, staffSeats }),
      });
      return res.json();
    },
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Выберите подписку</h1>
      
      {/* Plan comparison table */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Free plan card */}
        <PlanCard name="Free" price={0} features={['7 дней видео', '30 дней сообщения', '3 Jarvis/день']} />
        
        {/* Edu Basic card */}
        <PlanCard name="Edu Basic" price="от 35 ₽/место" features={['14 дней видео', '60 дней сообщения', '10 Jarvis/день', 'Overage storage']} />
        
        {/* Edu Pro card */}
        <PlanCard name="Edu Pro" price="2000 ₽/мес + места" features={['60 дней видео', '180 дней сообщения', '50 Jarvis/день', 'Постоянные доски']} />
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Калькулятор стоимости</h2>
        <div className="space-y-4">
          <div>
            <label>Количество student_editor:</label>
            <input type="number" value={studentSeats} onChange={(e) => setStudentSeats(+e.target.value)} className="ml-2 border px-2 py-1" />
          </div>
          <div>
            <label>Количество staff:</label>
            <input type="number" value={staffSeats} onChange={(e) => setStaffSeats(+e.target.value)} className="ml-2 border px-2 py-1" />
          </div>
          <div className="text-xl font-bold">
            Итого: {calculateTotal()} ₽/мес
          </div>
          <p className="text-sm text-gray-600">+ overage storage 50 ₽/ГБ‑мес при превышении лимитов</p>
        </div>
        <button onClick={() => purchaseMutation.mutate()} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded">Купить подписку</button>
      </div>

      {/* Donate section */}
      <div className="bg-yellow-50 rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">❤️ Поддержать автора</h2>
        <p className="mb-4">Любая сумма от 20 ₽ — не даёт прав, только благодарность!</p>
        <div className="flex gap-2">
          <button className="bg-yellow-500 text-white px-4 py-2 rounded">20 ₽</button>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded">50 ₽</button>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded">100 ₽</button>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded">500 ₽</button>
          <input type="number" placeholder="Другая сумма" className="border px-2 py-1" />
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
```

---

## 🚀 План внедрения

### Фаза 1: Базовая структура БД (1-2 недели)

- [ ] Создать миграции для таблиц:
  - `subscription_plan`
  - `seat_pricing`
  - `overage_pricing`
  - `org`
  - `org_subscription`
  - `org_entitlement`
  - `storage_overage_daily`
  - `donation_settings`
  - `donation`
  - `pricing_change_log`

- [ ] Заполнить начальные данные (3 плана + цены seats)

- [ ] Создать модели GORM в `backend/internal/db/models/`

### Фаза 2: Аутентификация и права (1-2 недели)

- [ ] Интегрировать Keycloak OIDC в Go backend
  - Middleware для проверки JWT-токенов
  - Извлечение `user_id` из токена

- [ ] Реализовать сервис авторизации:
  - `CanAccessSpecialChannel(userID, channelID)`
  - `HasOrgSubscription(orgID)`
  - `CheckEntitlement(orgID, featureKey)`

- [ ] Добавить проверки прав в API endpoints:
  - `/api/channels/:id` — проверка подписки для спец-каналов
  - `/api/boards/:id` — проверка `boards_persist` entitlement

### Фаза 3: Биллинг и расчёт seats (2-3 недели)

- [ ] Реализовать `SeatBillingService`:
  - `CountBillableSeats(orgID, period)`
  - `CalculateMonthlyCharge(orgID, planID)`

- [ ] Реализовать `StorageService`:
  - `CalculateStorageOverage(orgID)`
  - `ShouldDeleteObject(object, plan)` — политика retention

- [ ] Создать cronjob для биллинга:
  - Запуск раз в месяц
  - Подсчёт billable seats
  - Подсчёт overage storage
  - Создание счёта (invoice)

- [ ] API endpoints:
  - `GET /api/subscription/current` — текущая подписка org
  - `GET /api/subscription/usage` — использование seats и overage
  - `POST /api/subscription/purchase` — покупка/обновление

### Фаза 4: Интеграция оплаты (2-3 недели)

- [ ] YooKassa:
  - Регистрация в YooKassa
  - Реализовать `YooKassaService`
  - Обработка webhook'ов для подтверждения платежа
  - Автопродление подписок (recurring)

- [ ] Прямой перевод:
  - UI для ввода последних 4 цифр
  - Админ-панель для подтверждения платежей
  - Уведомления админам о новых переводах

- [ ] Донаты:
  - API endpoint `POST /api/donate`
  - Интеграция с YooKassa (одноразовый платёж)
  - Спасибо-страница

### Фаза 5: Frontend UI (2-3 недели)

- [ ] Страница `/subscription`:
  - Сравнение планов
  - Калькулятор стоимости
  - Форма оплаты (YooKassa / перевод)
  - Секция "Поддержать автора"

- [ ] Админ-панель `/admin/pricing`:
  - Управление планами (inline-редактирование)
  - Управление ценами seats
  - Управление overage-метрик
  - Настройки донатов
  - История изменений (`pricing_change_log`)

- [ ] Индикаторы подписки в UI:
  - Badge "Edu Pro" рядом с названием org
  - Уведомления о истечении подписки
  - Лимиты использования (seats, Jarvis, storage)

### Фаза 6: Тестирование и документация (1-2 недели)

- [ ] Unit-тесты для биллинг-логики
- [ ] Integration-тесты для оплаты (sandbox YooKassa)
- [ ] E2E-тесты для purchase flow
- [ ] Документация для пользователей:
  - Как купить подписку
  - Как оплатить переводом
  - Как поддержать автора
- [ ] Документация для админов:
  - Как управлять ценами
  - Как подтверждать ручные платежи

---

## 📋 Чеклист готовности к продакшену

### Безопасность

- [ ] HTTPS на всех эндпоинтах
- [ ] JWT-токены с коротким TTL (15 мин) + refresh token
- [ ] Rate limiting на API (особенно `/api/subscription/purchase`)
- [ ] Валидация всех входных данных (amount, seats, orgID)
- [ ] SQL-инъекции защита (GORM использует prepared statements)
- [ ] XSS защита в React (по умолчанию есть)
- [ ] CSRF токены для форм оплаты

### Мониторинг

- [ ] Логирование всех платежных транзакций
- [ ] Алерты при ошибках оплаты
- [ ] Метрики биллинга (revenue, MRR, churn)
- [ ] Дашборд для супер-админа (текущие подписки, доход)

### Бэкапы

- [ ] Ежедневные бэкапы PostgreSQL
- [ ] Тестирование восстановления из бэкапа
- [ ] Хранение бэкапов в отдельном хранилище (S3/Backblaze)

### Комплаенс

- [ ] Пользовательское соглашение (ToS)
- [ ] Политика возврата средств
- [ ] Оферта для подписок
- [ ] Юридическая информация о ИП/ООО
- [ ] Чеки/инвойсы для бизнес-клиентов (по запросу)

---

## 🔗 Полезные ссылки

- [YooKassa API документация](https://yookassa.ru/developers/api)
- [YooKassa recurring платежи](https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/basics)
- [Keycloak OIDC документация](https://www.keycloak.org/docs/latest/securing_apps/index.html#_oidc)
- [GORM документация](https://gorm.io/docs/)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)

---

## 📞 Контакты для вопросов

Если возникли вопросы по интеграции системы подписок:
- Создайте issue в репозитории: [github.com/kirin2461/Nemaxks/issues](https://github.com/kirin2461/Nemaxks/issues)
- Обсудите в Discussions: [github.com/kirin2461/Nemaxks/discussions](https://github.com/kirin2461/Nemaxks/discussions)

---

**Версия документа**: 1.0  
**Дата создания**: 9 января 2026  
**Автор**: @kirin2461
