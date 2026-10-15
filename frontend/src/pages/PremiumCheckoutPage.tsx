import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { useLocation, useSearch } from "wouter";
import {
  Crown, Check, Shield, CreditCard, Wallet, ArrowLeft,
  Loader2, AlertCircle, Clock, Tag, CheckCircle, Lock, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionPlan {
  id: number;
  slug: string;
  name: string;
  description: string;
  base_price_rub: number;
  video_retention_days: number;
  messages_retention_days: number;
  jarvis_daily_limit: number;
  boards_persist_flag: boolean;
  overage_storage_enabled: boolean;
  traffic_reports_enabled: boolean;
  is_active: boolean;
}

interface PromoValidation {
  valid: boolean;
  code?: string;
  discount_percent?: number;
  discount_amount?: number;
  error?: string;
}

export default function PremiumCheckoutPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, isAuthenticated, checkAuth } = useStore();

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testModeSuccess, setTestModeSuccess] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [promoValidation, setPromoValidation] = useState<PromoValidation | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"card" | "sbp" | "manual">("card");

  const planSlug = new URLSearchParams(searchString).get("plan");

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/auth?redirect=/premium/checkout?plan=" + planSlug);
      return;
    }
    fetchPlan();
  }, [planSlug, isAuthenticated]);

  const fetchPlan = async () => {
    if (!planSlug) {
      setError("План не указан");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/subscription-plans");
      if (response.ok) {
        const plans = await response.json();
        const foundPlan = plans.find((p: SubscriptionPlan) => p.slug === planSlug);
        if (foundPlan) {
          setPlan(foundPlan);
        } else {
          setError("План не найден");
        }
      } else {
        setError("Ошибка загрузки плана");
      }
    } catch (err) {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;

    setValidatingPromo(true);
    try {
      const response = await fetch(`/api/promo/validate?code=${promoCode}&plan_id=${plan?.id}`);
      const data = await response.json();
      setPromoValidation(data);
    } catch {
      setPromoValidation({ valid: false, error: "Ошибка проверки" });
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!plan || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          plan_slug: plan.slug,
          promo_code: promoValidation?.valid ? promoCode : undefined,
          payment_method: paymentMethod
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else if (data.test_mode) {
        setTestModeSuccess(data.message || "Тестовый платёж: подписка активирована");
        checkAuth().catch(() => {});
        setTimeout(() => {
          setLocation("/premium");
        }, 1500);
        return;
      } else if (data.status === "free_with_promo") {
        setLocation("/premium?status=success");
      } else if (data.message) {
        setError(data.message);
      }
    } catch (err) {
      setError("Ошибка при оформлении подписки");
    } finally {
      setProcessing(false);
    }
  };

  const getFinalPrice = () => {
    if (!plan) return 0;
    let price = plan.base_price_rub;
    if (promoValidation?.valid) {
      if (promoValidation.discount_percent) {
        price = price * (1 - promoValidation.discount_percent / 100);
      } else if (promoValidation.discount_amount) {
        price = price - promoValidation.discount_amount;
      }
    }
    return Math.max(0, price);
  };

  const getFeatures = (): string[] => {
    if (!plan) return [];
    const features: string[] = [];
    if (plan.jarvis_daily_limit > 0) {
      features.push(`${plan.jarvis_daily_limit} запросов Jarvis AI в день`);
    }
    if (plan.boards_persist_flag) {
      features.push("Постоянное хранение досок");
    }
    if (plan.video_retention_days > 0) {
      features.push(`${plan.video_retention_days} дней хранения видео`);
    }
    if (plan.messages_retention_days > 0) {
      features.push(`${plan.messages_retention_days} дней хранения сообщений`);
    }
    if (plan.overage_storage_enabled) {
      features.push("Расширенное хранилище");
    }
    if (plan.traffic_reports_enabled) {
      features.push("Отчёты по трафику");
    }
    return features;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="skeleton h-6 w-40" />
            <div className="grid md:grid-cols-2 gap-8">
              <div className="skeleton h-96 rounded-2xl" />
              <div className="space-y-6">
                <div className="skeleton h-32 rounded-2xl" />
                <div className="skeleton h-48 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !plan) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center">
            <AlertCircle className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
          </div>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => setLocation("/premium")}
            className="text-primary underline-offset-4 hover:underline text-sm font-medium"
          >
            Вернуться к планам
          </button>
        </div>
      </Layout>
    );
  }

  if (testModeSuccess) {
    return (
      <Layout>
        <div className="min-h-screen bg-background p-6 flex items-center justify-center">
          <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-card shadow-elev p-8 text-center animate-scale-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-display font-bold text-graphite-900 mb-2">Подписка активирована (тестовый режим)</h2>
            <p className="text-muted-foreground mb-3">{testModeSuccess}</p>
            <p className="text-sm text-emerald-700 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Перенаправление на страницу Premium...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const finalPrice = getFinalPrice();
  const features = getFeatures();

  return (
    <Layout>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setLocation("/premium")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors duration-150 text-sm"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
            Назад к планам
          </button>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Order summary */}
            <div className="rounded-2xl border border-border bg-card shadow-soft p-6 animate-rise-in h-fit">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary rounded-xl shadow-lg-brand">
                  <Crown className="text-primary-foreground" size={24} strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-graphite-900">{plan?.name}</h2>
                  <p className="text-muted-foreground text-sm">{plan?.description}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {features.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="p-1 bg-accent rounded-full">
                      <Check size={14} className="text-emerald-700" strokeWidth={2} />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Clock size={16} strokeWidth={1.75} />
                  <span>Ежемесячная подписка</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield size={16} strokeWidth={1.75} />
                  <span>Автопродление можно отключить</span>
                </div>
              </div>
            </div>

            {/* Payment form */}
            <div className="space-y-6 animate-slide-in-right">
              <div className="rounded-2xl border border-border bg-card shadow-soft p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Промокод</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-400" size={18} strokeWidth={1.75} />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoValidation(null);
                      }}
                      placeholder="Введите промокод"
                      className="input-field pl-10 font-mono"
                    />
                  </div>
                  <button
                    onClick={validatePromoCode}
                    disabled={validatingPromo || !promoCode.trim()}
                    className={cn(
                      "h-10 px-4 rounded-lg text-sm font-medium shrink-0",
                      "bg-secondary text-secondary-foreground hover:bg-graphite-200",
                      "transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    {validatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Применить"}
                  </button>
                </div>
                {promoValidation && (
                  <div className={cn(
                    "mt-3 p-3 rounded-lg border text-sm animate-fade-in-soft",
                    promoValidation.valid
                      ? "bg-success-soft border-emerald-200 text-emerald-800"
                      : "bg-danger-soft border-destructive/30 text-destructive"
                  )}>
                    {promoValidation.valid ? (
                      <p>Скидка {promoValidation.discount_percent}% применена!</p>
                    ) : (
                      <p>{promoValidation.error || "Промокод недействителен"}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card shadow-soft p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Способ оплаты</h3>
                <div className="space-y-3">
                  <label
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150",
                      paymentMethod === "card"
                        ? "border-primary bg-accent"
                        : "border-border hover:border-graphite-300 hover:bg-accent/60"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                      className="sr-only"
                    />
                    <CreditCard className={paymentMethod === "card" ? "text-primary" : "text-graphite-400"} size={24} strokeWidth={1.75} />
                    <div>
                      <p className="text-foreground text-sm font-medium">Банковская карта</p>
                      <p className="text-muted-foreground text-xs">Visa, Mastercard, МИР</p>
                    </div>
                    {paymentMethod === "card" && <Check size={16} className="ml-auto text-primary animate-pop-menu" />}
                  </label>

                  <label
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150",
                      paymentMethod === "sbp"
                        ? "border-primary bg-accent"
                        : "border-border hover:border-graphite-300 hover:bg-accent/60"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "sbp"}
                      onChange={() => setPaymentMethod("sbp")}
                      className="sr-only"
                    />
                    <Wallet className={paymentMethod === "sbp" ? "text-primary" : "text-graphite-400"} size={24} strokeWidth={1.75} />
                    <div>
                      <p className="text-foreground text-sm font-medium">СБП</p>
                      <p className="text-muted-foreground text-xs">Система быстрых платежей</p>
                    </div>
                    {paymentMethod === "sbp" && <Check size={16} className="ml-auto text-primary animate-pop-menu" />}
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card shadow-none p-6">
                <div className="flex justify-between items-center gap-4 mb-2 text-sm">
                  <span className="text-muted-foreground">Стоимость плана</span>
                  <span className="text-foreground border-b border-dotted border-graphite-300 flex-1 mx-1 -translate-y-1" />
                  <span className="text-foreground font-medium">{plan?.base_price_rub} ₽</span>
                </div>
                {promoValidation?.valid && (
                  <div className="flex justify-between items-center gap-4 mb-2 text-sm text-emerald-700">
                    <span>Скидка по промокоду</span>
                    <span className="border-b border-dotted border-emerald-300 flex-1 mx-1 -translate-y-1" />
                    <span className="font-medium">-{plan!.base_price_rub - finalPrice} ₽</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-semibold">Итого</span>
                    <span className="text-xl font-display font-bold text-graphite-900">
                      {finalPrice} ₽
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-danger-soft border border-destructive/30 rounded-xl animate-rise-in">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={processing}
                className={cn(
                  "w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium",
                  "bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand",
                  "transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <Lock size={16} strokeWidth={1.75} />
                    Оплатить {finalPrice} ₽
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-graphite-400 text-center">
                <ShieldCheck size={14} strokeWidth={1.75} />
                Нажимая кнопку, вы соглашаетесь с условиями подписки
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
