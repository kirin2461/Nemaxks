import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { useLocation, useSearch } from "wouter";
import {
  Crown, Check, Shield, CreditCard, Wallet, ArrowLeft,
  Loader2, AlertCircle, Sparkles, Clock, Tag, CheckCircle
} from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error && !plan) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => setLocation("/premium")}
            className="text-primary hover:text-primary/80"
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
        <div className="min-h-screen bg-nebula p-6 flex items-center justify-center">
          <div className="max-w-md w-full glass rounded-2xl p-8 shadow-soft border border-emerald-500/30 bg-emerald-500/10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Подписка активирована (тестовый режим)</h2>
            <p className="text-muted-foreground mb-3">{testModeSuccess}</p>
            <p className="text-sm text-emerald-400 flex items-center justify-center gap-2">
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
      <div className="min-h-screen bg-nebula p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setLocation("/premium")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Назад к планам
          </button>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-brand rounded-xl glow">
                  <Crown className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{plan?.name}</h2>
                  <p className="text-muted-foreground text-sm">{plan?.description}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {features.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="p-1 bg-accent/15 rounded-full">
                      <Check size={14} className="text-accent" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Clock size={16} />
                  <span>Ежемесячная подписка</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield size={16} />
                  <span>Автопродление можно отключить</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass rounded-2xl p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-foreground mb-4">Промокод</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoValidation(null);
                      }}
                      placeholder="Введите промокод"
                      className="input-field !rounded-xl py-3 pl-10"
                    />
                  </div>
                  <button
                    onClick={validatePromoCode}
                    disabled={validatingPromo || !promoCode.trim()}
                    className="px-4 py-3 gradient-brand hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 rounded-xl font-medium text-primary-foreground shadow-soft transition-all"
                  >
                    {validatingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : "Применить"}
                  </button>
                </div>
                {promoValidation && (
                  <div className={`mt-3 p-3 rounded-lg ${promoValidation.valid ? "bg-accent/10 border border-accent/30" : "bg-red-500/10 border border-red-500/30"}`}>
                    {promoValidation.valid ? (
                      <p className="text-accent text-sm">
                        Скидка {promoValidation.discount_percent}% применена!
                      </p>
                    ) : (
                      <p className="text-red-400 text-sm">{promoValidation.error || "Промокод недействителен"}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="glass rounded-2xl p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-foreground mb-4">Способ оплаты</h3>
                <div className="space-y-3">
                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "card" 
                        ? "border-primary bg-primary/10 shadow-soft" 
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                      className="sr-only"
                    />
                    <CreditCard className={paymentMethod === "card" ? "text-primary" : "text-muted-foreground"} size={24} />
                    <div>
                      <p className="text-foreground font-medium">Банковская карта</p>
                      <p className="text-muted-foreground text-sm">Visa, Mastercard, МИР</p>
                    </div>
                  </label>
                  
                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "sbp" 
                        ? "border-primary bg-primary/10 shadow-soft" 
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "sbp"}
                      onChange={() => setPaymentMethod("sbp")}
                      className="sr-only"
                    />
                    <Wallet className={paymentMethod === "sbp" ? "text-primary" : "text-muted-foreground"} size={24} />
                    <div>
                      <p className="text-foreground font-medium">СБП</p>
                      <p className="text-muted-foreground text-sm">Система быстрых платежей</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="glass rounded-2xl p-6 shadow-soft">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Стоимость плана</span>
                  <span className="text-foreground">{plan?.base_price_rub} ₽</span>
                </div>
                {promoValidation?.valid && (
                  <div className="flex justify-between items-center mb-2 text-accent">
                    <span>Скидка по промокоду</span>
                    <span>-{plan!.base_price_rub - finalPrice} ₽</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-semibold text-lg">Итого</span>
                    <span className="text-2xl font-bold gradient-brand-text">
                      {finalPrice} ₽
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={processing}
                className="w-full py-4 gradient-brand hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 rounded-xl font-semibold text-lg text-primary-foreground flex items-center justify-center gap-2 transition-all shadow-glow"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Оплатить {finalPrice} ₽
                  </>
                )}
              </button>

              <p className="text-center text-muted-foreground text-sm">
                Нажимая кнопку, вы соглашаетесь с условиями подписки
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
