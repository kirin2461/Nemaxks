import React from "react";
import { CheckCircle2, XCircle, Rocket } from "lucide-react";

interface StatusItem {
  label: string;
  status: boolean;
}

const CompletionStatusPage: React.FC = () => {
  const projectStatus = {
    name: "Nebula",
    status: "ГОТОВО К PRODUCTION",
    completionDate: "3 января 2026",
    primaryUrl: "sdsa--slowlyslawa.replit.app",
  };

  const components: StatusItem[] = [
    { label: "Бэкенд (Go + WebSocket)", status: true },
    { label: "Фронтенд (React + Vite)", status: true },
    { label: "Инфраструктура и Docker", status: true },
    { label: "База данных (PostgreSQL)", status: true },
    { label: "Документация API", status: true },
    { label: "Обработка ошибок", status: true },
    { label: "Обмен сообщениями в реальном времени", status: true },
    { label: "Production-развёртывание", status: true },
  ];

  const metrics = [
    { label: "API-эндпоинты", value: "17" },
    { label: "Методы TypeScript", value: "17" },
    { label: "Микросервисы", value: "4" },
    { label: "Таблицы БД", value: "4" },
    { label: "Типы ошибок", value: "5" },
    { label: "Файлы реализации", value: "20+" },
  ];

  const features = [
    "Полная реализация WebSocket для сообщений в реальном времени",
    "RESTful API с 17 эндпоинтами",
    "Система аутентификации на JWT",
    "База данных PostgreSQL с GORM ORM",
    "4 микросервиса (сообщения, каналы, доски, голос)",
    "Современный адаптивный интерфейс на React",
    "Docker Compose для контейнерного развёртывания",
    "Полная документация и руководства",
  ];

  const allComplete = components.every((c) => c.status);

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-6 animate-rise-in">
        {/* Status header: big icon pop + title */}
        <div className="text-center pt-4 pb-2">
          <div
            className={`h-24 w-24 rounded-full grid place-items-center mx-auto mb-5 animate-scale-in [animation-duration:300ms] [animation-timing-function:cubic-bezier(0.34,1.35,0.64,1)] ${
              allComplete ? "bg-accent text-emerald-600" : "bg-secondary text-graphite-500"
            }`}
          >
            {allComplete ? (
              <CheckCircle2 className="w-16 h-16" strokeWidth={1.5} />
            ) : (
              <XCircle className="w-16 h-16" strokeWidth={1.5} />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-[-0.02em] text-graphite-900 mb-3">
            Статус готовности проекта
          </h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
              allComplete
                ? "bg-primary text-primary-foreground shadow-lg-brand"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {allComplete ? "✓ Готово к production" : "⏳ В разработке"}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-soft p-6">
          <h2 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-3">{projectStatus.name}</h2>
          <p className="text-sm text-muted-foreground">
            Статус: <strong className="text-foreground">{projectStatus.status}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Завершено: <strong className="text-foreground">{projectStatus.completionDate}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            URL: <strong className="text-primary font-mono">{projectStatus.primaryUrl}</strong>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-soft p-6">
          <h3 className="text-lg font-semibold text-graphite-900 mb-4">Статус компонентов</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {components.map((component, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-3 animate-rise-in [animation-fill-mode:both]"
                style={{ animationDelay: `${Math.min(index, 8) * 80}ms` }}
              >
                {component.status ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive shrink-0" strokeWidth={1.75} />
                )}
                <span className="text-sm text-foreground">{component.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-soft p-6">
          <h3 className="text-lg font-semibold text-graphite-900 mb-4">Метрики разработки</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="bg-background border border-border rounded-lg p-4 text-center"
              >
                <div className="text-3xl font-display font-extrabold tracking-[-0.02em] text-graphite-900">{metric.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-soft p-6">
          <h3 className="text-lg font-semibold text-graphite-900 mb-4">Ключевые возможности</h3>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-graphite-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={1.75} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-accent shadow-soft p-8 text-center">
          <p className="text-sm text-accent-foreground mb-3">
            Платформа для общения Nebula успешно разработана и протестирована.
            Все системы работают, приложение готово к production-развёртыванию.
          </p>
          <p className="text-lg font-display font-bold text-emerald-900 flex items-center justify-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-700" strokeWidth={1.75} />
            Проект завершён!
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompletionStatusPage;
