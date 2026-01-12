package main

import (
        "log"
        "time"
)

func seedSubscriptionPlans() {
        var count int64
        db.Model(&SubscriptionPlan{}).Count(&count)
        if count > 0 {
                return
        }

        plans := []SubscriptionPlan{
                {
                        Slug:                  "start",
                        Name:                  "Старт",
                        Description:           "Бесплатный план для начала: 7 дней видео, 30 дней сообщений, 3 запроса Jarvis AI/день. Базовые функции для пользователей и небольших групп.",
                        BasePriceRub:          0,
                        VideoRetentionDays:    7,
                        MessagesRetentionDays: 30,
                        PostsRetentionDays:    15,
                        LogsRetentionDays:     45,
                        BoardsPersistFlag:     false,
                        JarvisDailyLimit:      3,
                        OverageStorageEnabled: false,
                        TrafficReportsEnabled: false,
                        IsActive:              true,
                        CreatedAt:             time.Now(),
                        UpdatedAt:             time.Now(),
                },
                {
                        Slug:                  "pro",
                        Name:                  "Про",
                        Description:           "Расширенный план: 30 дней видео, 90 дней сообщений, 20 Jarvis AI запросов/день. HD видео, эксклюзивные темы, докупка хранилища. Для активных пользователей и курсов.",
                        BasePriceRub:          499,
                        VideoRetentionDays:    30,
                        MessagesRetentionDays: 90,
                        PostsRetentionDays:    60,
                        LogsRetentionDays:     60,
                        BoardsPersistFlag:     false,
                        JarvisDailyLimit:      20,
                        OverageStorageEnabled: true,
                        TrafficReportsEnabled: false,
                        IsActive:              true,
                        CreatedAt:             time.Now(),
                        UpdatedAt:             time.Now(),
                },
                {
                        Slug:                  "premium",
                        Name:                  "Премиум",
                        Description:           "Максимальный план: 90 дней видео, 365 дней сообщений, безлимитный Jarvis AI. Интерактивные доски и тетради, отчёты по трафику, приоритетная поддержка. Для организаций и VIP-пользователей.",
                        BasePriceRub:          1990,
                        VideoRetentionDays:    90,
                        MessagesRetentionDays: 365,
                        PostsRetentionDays:    180,
                        LogsRetentionDays:     180,
                        BoardsPersistFlag:     true,
                        JarvisDailyLimit:      999,
                        OverageStorageEnabled: true,
                        TrafficReportsEnabled: true,
                        IsActive:              true,
                        CreatedAt:             time.Now(),
                        UpdatedAt:             time.Now(),
                },
        }

        for _, plan := range plans {
                db.Create(&plan)
        }

        var startPlan, proPlan, premiumPlan SubscriptionPlan
        db.Where("slug = ?", "start").First(&startPlan)
        db.Where("slug = ?", "pro").First(&proPlan)
        db.Where("slug = ?", "premium").First(&premiumPlan)

        seatPrices := []SeatPricing{
                {PlanID: proPlan.ID, SeatType: "student_editor", PricePerMonthRub: 35, IsBillable: true, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: proPlan.ID, SeatType: "staff", PricePerMonthRub: 500, IsBillable: true, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: proPlan.ID, SeatType: "reader", PricePerMonthRub: 0, IsBillable: false, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: premiumPlan.ID, SeatType: "student_editor", PricePerMonthRub: 35, IsBillable: true, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: premiumPlan.ID, SeatType: "staff", PricePerMonthRub: 500, IsBillable: true, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: premiumPlan.ID, SeatType: "reader", PricePerMonthRub: 0, IsBillable: false, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
        }
        for _, sp := range seatPrices {
                db.Create(&sp)
        }

        overagePrices := []OveragePricing{
                {PlanID: &proPlan.ID, MetricType: "storage_gb_month", PriceRub: 50, Unit: "GB·месяц", Description: "Хранение сверх лимита плана", IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: &premiumPlan.ID, MetricType: "storage_gb_month", PriceRub: 50, Unit: "GB·месяц", Description: "Хранение сверх лимита плана", IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
                {PlanID: &premiumPlan.ID, MetricType: "jarvis_request_pack", PriceRub: 100, Unit: "50 запросов", Description: "Пакет запросов Jarvis", IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()},
        }
        for _, op := range overagePrices {
                db.Create(&op)
        }

        log.Println("Subscription plans seeded")
}

func seedGuildTemplates() {
        var count int64
        db.Model(&GuildTemplate{}).Count(&count)
        if count > 0 {
                return
        }

        templates := []GuildTemplate{
                {
                        Slug:         "basic-community",
                        Name:         "Базовое сообщество",
                        Description:  "Простой сервер для общения",
                        Category:     "community",
                        Icon:         "users",
                        RequiredPlan: "start",
                        ChannelsJSON: `[{"name": "общий", "type": "text"}, {"name": "голос", "type": "voice"}]`,
                        RolesJSON:    `[{"name": "Модератор", "color": "#3498db"}, {"name": "Участник", "color": "#95a5a6"}]`,
                        SettingsJSON: `{}`,
                        IsActive:     true,
                        UsageCount:   0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                },
                {
                        Slug:         "edu-course",
                        Name:         "Учебный курс",
                        Description:  "Сервер для онлайн-курса с лекциями и домашками",
                        Category:     "education",
                        Icon:         "graduation-cap",
                        RequiredPlan: "pro",
                        ChannelsJSON: `[{"name": "объявления", "type": "text"}, {"name": "лекции", "type": "text"}, {"name": "домашки", "type": "text"}, {"name": "вопросы", "type": "text"}, {"name": "голос-лекция", "type": "voice"}]`,
                        RolesJSON:    `[{"name": "Преподаватель", "color": "#e74c3c"}, {"name": "Куратор", "color": "#f39c12"}, {"name": "Студент", "color": "#3498db"}]`,
                        SettingsJSON: `{"announcements_only": ["объявления"]}`,
                        IsActive:     true,
                        UsageCount:   0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                },
                {
                        Slug:         "edu-university",
                        Name:         "Университет / Факультет",
                        Description:  "Полноценный сервер для учебного заведения",
                        Category:     "education",
                        Icon:         "building",
                        RequiredPlan: "premium",
                        ChannelsJSON: `[{"name": "новости", "type": "text"}, {"name": "расписание", "type": "text"}, {"name": "семинар-1", "type": "text"}, {"name": "семинар-2", "type": "text"}, {"name": "лаборатория", "type": "text"}, {"name": "интерактивная-доска", "type": "board"}, {"name": "тетрадь", "type": "notebook"}, {"name": "голос-аудитория", "type": "voice"}, {"name": "голос-консультация", "type": "voice"}]`,
                        RolesJSON:    `[{"name": "Декан", "color": "#9b59b6"}, {"name": "Профессор", "color": "#e74c3c"}, {"name": "Преподаватель", "color": "#f39c12"}, {"name": "Ассистент", "color": "#2ecc71"}, {"name": "Студент", "color": "#3498db"}]`,
                        SettingsJSON: `{"boards_persist": true, "notebooks_persist": true}`,
                        IsActive:     true,
                        UsageCount:   0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                },
                {
                        Slug:         "gaming-clan",
                        Name:         "Игровой клан",
                        Description:  "Сервер для игрового сообщества",
                        Category:     "gaming",
                        Icon:         "gamepad-2",
                        RequiredPlan: "start",
                        ChannelsJSON: `[{"name": "новости", "type": "text"}, {"name": "флуд", "type": "text"}, {"name": "поиск-тимы", "type": "text"}, {"name": "голос-1", "type": "voice"}, {"name": "голос-2", "type": "voice"}]`,
                        RolesJSON:    `[{"name": "Лидер", "color": "#e74c3c"}, {"name": "Офицер", "color": "#f39c12"}, {"name": "Рядовой", "color": "#3498db"}]`,
                        SettingsJSON: `{}`,
                        IsActive:     true,
                        UsageCount:   0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                },
                {
                        Slug:         "business-team",
                        Name:         "Бизнес команда",
                        Description:  "Сервер для рабочей команды",
                        Category:     "business",
                        Icon:         "briefcase",
                        RequiredPlan: "pro",
                        ChannelsJSON: `[{"name": "объявления", "type": "text"}, {"name": "общее", "type": "text"}, {"name": "проекты", "type": "text"}, {"name": "митинг", "type": "voice"}]`,
                        RolesJSON:    `[{"name": "Руководитель", "color": "#9b59b6"}, {"name": "Менеджер", "color": "#e74c3c"}, {"name": "Сотрудник", "color": "#3498db"}]`,
                        SettingsJSON: `{}`,
                        IsActive:     true,
                        UsageCount:   0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                },
        }

        for _, t := range templates {
                db.Create(&t)
        }

        log.Println("Guild templates seeded")
}

func seedChannelTemplates() {
        var count int64
        db.Model(&ChannelTemplate{}).Count(&count)
        if count > 0 {
                return
        }

        templates := []ChannelTemplate{
                {
                        Slug:            "lecture-room",
                        Name:            "Лекционный зал",
                        Description:     "Канал для проведения лекций с записью",
                        Type:            "text",
                        Category:        "lecture",
                        Icon:            "presentation",
                        RequiredPlan:    "pro",
                        SettingsJSON:    `{"slowmode": 30, "allow_attachments": true}`,
                        PermissionsJSON: `{"student": ["read", "react"], "teacher": ["read", "write", "manage"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "seminar-discussion",
                        Name:            "Семинар",
                        Description:     "Канал для обсуждений и дискуссий",
                        Type:            "text",
                        Category:        "seminar",
                        Icon:            "message-circle",
                        RequiredPlan:    "pro",
                        SettingsJSON:    `{"allow_threads": true}`,
                        PermissionsJSON: `{"student": ["read", "write"], "teacher": ["read", "write", "manage"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "homework-submission",
                        Name:            "Сдача домашек",
                        Description:     "Канал для сдачи домашних заданий",
                        Type:            "text",
                        Category:        "homework",
                        Icon:            "file-text",
                        RequiredPlan:    "pro",
                        SettingsJSON:    `{"allow_attachments": true, "private_threads": true}`,
                        PermissionsJSON: `{"student": ["read", "write"], "teacher": ["read", "write", "manage", "grade"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "interactive-whiteboard",
                        Name:            "Интерактивная доска",
                        Description:     "Совместная интерактивная доска для рисования и заметок",
                        Type:            "board",
                        Category:        "lecture",
                        Icon:            "pen-tool",
                        RequiredPlan:    "premium",
                        SettingsJSON:    `{"persist": true, "max_participants": 50}`,
                        PermissionsJSON: `{"student": ["view", "draw"], "teacher": ["view", "draw", "manage", "clear"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "student-notebook",
                        Name:            "Онлайн тетрадь",
                        Description:     "Персональная онлайн тетрадь для записей",
                        Type:            "notebook",
                        Category:        "homework",
                        Icon:            "book-open",
                        RequiredPlan:    "premium",
                        SettingsJSON:    `{"persist": true, "auto_save": true, "export_formats": ["pdf", "docx"]}`,
                        PermissionsJSON: `{"owner": ["read", "write", "share"], "teacher": ["read", "comment"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "voice-lecture",
                        Name:            "Голосовая лекция",
                        Description:     "Голосовой канал для проведения лекций",
                        Type:            "voice",
                        Category:        "lecture",
                        Icon:            "mic",
                        RequiredPlan:    "pro",
                        SettingsJSON:    `{"max_participants": 100, "allow_video": true, "allow_screen_share": true}`,
                        PermissionsJSON: `{"student": ["listen", "speak_on_request"], "teacher": ["speak", "mute_others", "screen_share"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "video-conference",
                        Name:            "Видеоконференция",
                        Description:     "Канал для видеозвонков и консультаций",
                        Type:            "video",
                        Category:        "seminar",
                        Icon:            "video",
                        RequiredPlan:    "premium",
                        SettingsJSON:    `{"max_participants": 25, "allow_recording": true, "hd_video": true}`,
                        PermissionsJSON: `{"student": ["join", "video", "speak"], "teacher": ["join", "video", "speak", "record", "manage"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
                {
                        Slug:            "general-chat",
                        Name:            "Общий чат",
                        Description:     "Канал для свободного общения",
                        Type:            "text",
                        Category:        "discussion",
                        Icon:            "message-square",
                        RequiredPlan:    "start",
                        SettingsJSON:    `{}`,
                        PermissionsJSON: `{"everyone": ["read", "write"]}`,
                        IsActive:        true,
                        UsageCount:      0,
                        CreatedAt:       time.Now(),
                        UpdatedAt:       time.Now(),
                },
        }

        for _, t := range templates {
                db.Create(&t)
        }

        log.Println("Channel templates seeded")
}

func seedDonationSettings() {
        var count int64
        db.Model(&DonationSettings{}).Count(&count)
        if count > 0 {
                return
        }

        settings := DonationSettings{
                MinAmountRub:       20,
                DefaultAmountsJSON: `[20, 50, 100, 500]`,
                ThankYouMessage:    "Спасибо за поддержку! Ваш вклад помогает развивать платформу.",
                IsEnabled:          true,
                UpdatedAt:          time.Now(),
        }
        db.Create(&settings)

        log.Println("Donation settings seeded")
}

func initOrgBillingSeeds() {
        seedSubscriptionPlans()
        seedGuildTemplates()
        seedChannelTemplates()
        seedDonationSettings()
}
