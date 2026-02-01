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

func seedEducationalToolTemplates() {
        var count int64
        db.Model(&EducationalToolTemplate{}).Count(&count)
        if count > 0 {
                return
        }

        templates := []EducationalToolTemplate{
                // Notebooks - Тетради по предметам
                {Slug: "notebook-math", Name: "Математика", Description: "Интерактивная тетрадь с поддержкой LaTeX формул, графиков и геометрических построений", ToolType: "notebook", Category: "subjects", SubCategory: "math", Icon: "calculator", RequiredPlan: "edu_basic", SortOrder: 1, ConfigJSON: `{"type":"math","features":["latex","graphs","geometry"]}`},
                {Slug: "notebook-physics", Name: "Физика", Description: "Тетрадь с симуляциями, формулами и диаграммами", ToolType: "notebook", Category: "subjects", SubCategory: "physics", Icon: "atom", RequiredPlan: "edu_basic", SortOrder: 2, ConfigJSON: `{"type":"physics","features":["simulations","formulas","diagrams"]}`},
                {Slug: "notebook-chemistry", Name: "Химия", Description: "Тетрадь с периодической таблицей и молекулярными структурами", ToolType: "notebook", Category: "subjects", SubCategory: "chemistry", Icon: "flask", RequiredPlan: "edu_basic", SortOrder: 3, ConfigJSON: `{"type":"chemistry","features":["periodic_table","molecules"]}`},
                {Slug: "notebook-biology", Name: "Биология", Description: "Тетрадь с анатомическими схемами и диаграммами", ToolType: "notebook", Category: "subjects", SubCategory: "biology", Icon: "dna", RequiredPlan: "edu_basic", SortOrder: 4, ConfigJSON: `{"type":"biology","features":["anatomy","diagrams"]}`},
                {Slug: "notebook-history", Name: "История", Description: "Тетрадь с таймлайнами и историческими картами", ToolType: "notebook", Category: "subjects", SubCategory: "history", Icon: "landmark", RequiredPlan: "edu_basic", SortOrder: 5, ConfigJSON: `{"type":"history","features":["timelines","maps"]}`},
                {Slug: "notebook-geography", Name: "География", Description: "Тетрадь с интерактивными картами", ToolType: "notebook", Category: "subjects", SubCategory: "geography", Icon: "globe", RequiredPlan: "edu_basic", SortOrder: 6, ConfigJSON: `{"type":"geography","features":["maps","interactive"]}`},
                {Slug: "notebook-literature", Name: "Литература", Description: "Тетрадь для анализа текстов, цитат и конспектов", ToolType: "notebook", Category: "subjects", SubCategory: "literature", Icon: "book-open", RequiredPlan: "edu_basic", SortOrder: 7, ConfigJSON: `{"type":"literature","features":["text_analysis","quotes","notes"]}`},

                // Notebooks - Универсальные
                {Slug: "notebook-lecture", Name: "Конспект лекции", Description: "Структурированный шаблон для записи лекций", ToolType: "notebook", Category: "universal", SubCategory: "lecture", Icon: "file-text", RequiredPlan: "free", SortOrder: 10, ConfigJSON: `{"type":"lecture","sections":["theme","key_points","questions","summary"]}`},
                {Slug: "notebook-exam-prep", Name: "Подготовка к экзамену", Description: "Разделы: теория, формулы, задачи, заметки", ToolType: "notebook", Category: "universal", SubCategory: "exam", Icon: "graduation-cap", RequiredPlan: "edu_basic", SortOrder: 11, ConfigJSON: `{"type":"exam","sections":["theory","formulas","problems","notes"]}`},
                {Slug: "notebook-research", Name: "Исследовательский проект", Description: "Гипотеза, методы, данные, выводы", ToolType: "notebook", Category: "universal", SubCategory: "research", Icon: "microscope", RequiredPlan: "edu_pro", SortOrder: 12, ConfigJSON: `{"type":"research","sections":["hypothesis","methods","data","conclusions"]}`},
                {Slug: "notebook-planner", Name: "Ежедневник студента", Description: "Расписание, задачи, заметки", ToolType: "notebook", Category: "universal", SubCategory: "planner", Icon: "calendar", RequiredPlan: "free", SortOrder: 13, ConfigJSON: `{"type":"planner","sections":["schedule","tasks","notes"]}`},

                // Whiteboards - Учебные доски
                {Slug: "board-math", Name: "Математическая доска", Description: "Сетка, линейка, циркуль, графики функций", ToolType: "whiteboard", Category: "educational", SubCategory: "math", Icon: "ruler", RequiredPlan: "edu_basic", SortOrder: 20, ConfigJSON: `{"type":"math","tools":["grid","ruler","compass","graphs"]}`},
                {Slug: "board-physics", Name: "Физическая доска", Description: "Векторы, схемы опытов, диаграммы сил", ToolType: "whiteboard", Category: "educational", SubCategory: "physics", Icon: "compass", RequiredPlan: "edu_basic", SortOrder: 21, ConfigJSON: `{"type":"physics","tools":["vectors","experiments","force_diagrams"]}`},
                {Slug: "board-chemistry", Name: "Химическая доска", Description: "Молекулы, реакции, лабораторное оборудование", ToolType: "whiteboard", Category: "educational", SubCategory: "chemistry", Icon: "test-tube", RequiredPlan: "edu_basic", SortOrder: 22, ConfigJSON: `{"type":"chemistry","tools":["molecules","reactions","lab_equipment"]}`},
                {Slug: "board-geography", Name: "Географическая доска", Description: "Контурные карты, рельеф", ToolType: "whiteboard", Category: "educational", SubCategory: "geography", Icon: "map", RequiredPlan: "edu_basic", SortOrder: 23, ConfigJSON: `{"type":"geography","tools":["contour_maps","relief"]}`},

                // Whiteboards - Творческие
                {Slug: "board-brainstorm", Name: "Brainstorming", Description: "Стикеры, связи, mind-maps", ToolType: "whiteboard", Category: "creative", SubCategory: "brainstorm", Icon: "lightbulb", RequiredPlan: "free", SortOrder: 30, ConfigJSON: `{"type":"brainstorm","tools":["stickers","connections","mindmaps"]}`},
                {Slug: "board-kanban", Name: "Канбан-доска", Description: "Для проектной работы", ToolType: "whiteboard", Category: "creative", SubCategory: "kanban", Icon: "layout-kanban", RequiredPlan: "free", SortOrder: 31, ConfigJSON: `{"type":"kanban","columns":["todo","in_progress","done"]}`},
                {Slug: "board-presentation", Name: "Презентационная доска", Description: "Для объяснения материала", ToolType: "whiteboard", Category: "creative", SubCategory: "presentation", Icon: "presentation", RequiredPlan: "edu_basic", SortOrder: 32, ConfigJSON: `{"type":"presentation","tools":["slides","pointer","annotations"]}`},
                {Slug: "board-collab", Name: "Коллаборативная доска", Description: "Для групповой работы в реальном времени", ToolType: "whiteboard", Category: "creative", SubCategory: "collaboration", Icon: "users", RequiredPlan: "edu_pro", SortOrder: 33, ConfigJSON: `{"type":"collaboration","features":["realtime","cursors","chat"]}`},

                // Whiteboards - Специализированные
                {Slug: "board-music", Name: "Музыкальная доска", Description: "Нотный стан, инструменты", ToolType: "whiteboard", Category: "specialized", SubCategory: "music", Icon: "music", RequiredPlan: "edu_pro", SortOrder: 40, ConfigJSON: `{"type":"music","tools":["staff","notes","instruments"]}`},
                {Slug: "board-chess", Name: "Шахматная доска", Description: "Для анализа партий", ToolType: "whiteboard", Category: "specialized", SubCategory: "chess", Icon: "crown", RequiredPlan: "edu_basic", SortOrder: 41, ConfigJSON: `{"type":"chess","features":["board","pieces","analysis"]}`},
                {Slug: "board-language", Name: "Языковая доска", Description: "Карточки, переводы, транскрипции", ToolType: "whiteboard", Category: "specialized", SubCategory: "language", Icon: "languages", RequiredPlan: "edu_basic", SortOrder: 42, ConfigJSON: `{"type":"language","tools":["flashcards","translations","transcriptions"]}`},

                // Editors - Программирование
                {Slug: "editor-python", Name: "Python IDE", Description: "Для начинающих с подсказками и туториалами", ToolType: "editor", Category: "programming", SubCategory: "python", Icon: "code", RequiredPlan: "edu_basic", SortOrder: 50, ConfigJSON: `{"language":"python","features":["hints","tutorials","autocomplete"]}`},
                {Slug: "editor-web", Name: "JavaScript/Web IDE", Description: "HTML + CSS + JS с живым превью", ToolType: "editor", Category: "programming", SubCategory: "web", Icon: "globe", RequiredPlan: "edu_basic", SortOrder: 51, ConfigJSON: `{"languages":["html","css","javascript"],"features":["live_preview"]}`},
                {Slug: "editor-scratch", Name: "Визуальное программирование", Description: "Scratch-подобный редактор для детей", ToolType: "editor", Category: "programming", SubCategory: "visual", Icon: "puzzle", RequiredPlan: "free", SortOrder: 52, ConfigJSON: `{"type":"visual","blocks":true,"age":"kids"}`},
                {Slug: "editor-sql", Name: "SQL Playground", Description: "Учебная БД с заданиями", ToolType: "editor", Category: "programming", SubCategory: "sql", Icon: "database", RequiredPlan: "edu_basic", SortOrder: 53, ConfigJSON: `{"language":"sql","features":["sample_db","exercises"]}`},
                {Slug: "editor-cpp", Name: "C++/Java IDE", Description: "Для олимпиадного программирования", ToolType: "editor", Category: "programming", SubCategory: "competitive", Icon: "trophy", RequiredPlan: "edu_pro", SortOrder: 54, ConfigJSON: `{"languages":["cpp","java"],"features":["competitive","tests"]}`},
                {Slug: "editor-arduino", Name: "Arduino IDE", Description: "Для робототехники", ToolType: "editor", Category: "programming", SubCategory: "hardware", Icon: "cpu", RequiredPlan: "edu_pro", SortOrder: 55, ConfigJSON: `{"language":"arduino","features":["simulator","circuits"]}`},

                // Editors - Научные
                {Slug: "editor-jupyter", Name: "Jupyter Notebook", Description: "Python + визуализации для Data Science", ToolType: "editor", Category: "scientific", SubCategory: "datascience", Icon: "bar-chart", RequiredPlan: "edu_pro", SortOrder: 60, ConfigJSON: `{"type":"jupyter","features":["python","visualizations","datascience"]}`},
                {Slug: "editor-markdown", Name: "Markdown редактор", Description: "Для документации и отчётов", ToolType: "editor", Category: "documents", SubCategory: "markdown", Icon: "file-text", RequiredPlan: "free", SortOrder: 61, ConfigJSON: `{"language":"markdown","features":["preview","export"]}`},
                {Slug: "editor-latex", Name: "LaTeX редактор", Description: "Для научных работ", ToolType: "editor", Category: "scientific", SubCategory: "latex", Icon: "sigma", RequiredPlan: "edu_pro", SortOrder: 62, ConfigJSON: `{"language":"latex","features":["preview","formulas","bibliography"]}`},

                // Document Templates - Для учителей
                {Slug: "template-lesson-plan", Name: "План урока", Description: "Цели, этапы, материалы, домашнее задание", ToolType: "notebook", Category: "teachers", SubCategory: "planning", Icon: "clipboard-list", RequiredPlan: "edu_basic", SortOrder: 70, ConfigJSON: `{"sections":["goals","stages","materials","homework"]}`},
                {Slug: "template-test", Name: "Создание теста", Description: "Тесты с автопроверкой", ToolType: "editor", Category: "teachers", SubCategory: "testing", Icon: "check-circle", RequiredPlan: "edu_basic", SortOrder: 71, ConfigJSON: `{"type":"quiz","features":["autocheck","analytics"]}`},
                {Slug: "template-gradebook", Name: "Журнал оценок", Description: "Учёт успеваемости", ToolType: "notebook", Category: "teachers", SubCategory: "grades", Icon: "book", RequiredPlan: "edu_pro", SortOrder: 72, ConfigJSON: `{"type":"gradebook","features":["students","grades","analytics"]}`},

                // Document Templates - Для учеников
                {Slug: "template-homework", Name: "Домашняя работа", Description: "Шаблон с разделами по предметам", ToolType: "notebook", Category: "students", SubCategory: "homework", Icon: "home", RequiredPlan: "free", SortOrder: 80, ConfigJSON: `{"sections":["subject","task","solution","questions"]}`},
                {Slug: "template-coursework", Name: "Курсовая работа", Description: "Титульный лист, содержание, главы, библиография", ToolType: "notebook", Category: "students", SubCategory: "coursework", Icon: "scroll", RequiredPlan: "edu_basic", SortOrder: 81, ConfigJSON: `{"sections":["title","contents","chapters","bibliography"]}`},
                {Slug: "template-experiment", Name: "Научный эксперимент", Description: "Цель, гипотеза, ход работы, выводы", ToolType: "notebook", Category: "students", SubCategory: "experiment", Icon: "beaker", RequiredPlan: "edu_basic", SortOrder: 82, ConfigJSON: `{"sections":["goal","hypothesis","procedure","conclusions"]}`},
                {Slug: "template-reading-diary", Name: "Читательский дневник", Description: "Книга, автор, впечатления, цитаты", ToolType: "notebook", Category: "students", SubCategory: "reading", Icon: "book-open", RequiredPlan: "free", SortOrder: 83, ConfigJSON: `{"sections":["book","author","impressions","quotes"]}`},

                // Group Work Templates
                {Slug: "template-team-project", Name: "Командный проект", Description: "Распределение ролей, задачи, дедлайны", ToolType: "whiteboard", Category: "group", SubCategory: "project", Icon: "users", RequiredPlan: "edu_basic", SortOrder: 90, ConfigJSON: `{"type":"project","features":["roles","tasks","deadlines"]}`},
                {Slug: "template-debate", Name: "Дебаты", Description: "Аргументы за/против, источники", ToolType: "whiteboard", Category: "group", SubCategory: "debate", Icon: "message-square", RequiredPlan: "edu_basic", SortOrder: 91, ConfigJSON: `{"sections":["pro","contra","sources"]}`},
        }

        for i := range templates {
                templates[i].IsActive = true
        }

        db.Create(&templates)
        log.Println("Educational tool templates seeded:", len(templates))
}

func initOrgBillingSeeds() {
        seedSubscriptionPlans()
        seedGuildTemplates()
        seedChannelTemplates()
        seedDonationSettings()
        seedEducationalToolTemplates()
}
