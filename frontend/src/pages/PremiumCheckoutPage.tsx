import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { useLocation, useSearch } from "wouter";
import { 
  Crown, Check, Shield, CreditCard, Wallet, ArrowLeft,
  Loader2, AlertCircle, Sparkles, Clock, Tag
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
  const { user, isAuthenticated } = useStore();
  
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </Layout>
    );
  }

  if (error && !plan) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => setLocation("/premium")}
            className="text-purple-400 hover:text-purple-300"
          >
            Вернуться к планам
          </button>
        </div>
      </Layout>
    );
  }

  const finalPrice = getFinalPrice();
  const features = getFeatures();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setLocation("/premium")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Назад к планам
          </button>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                  <Crown className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{plan?.name}</h2>
                  <p className="text-gray-400 text-sm">{plan?.description}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {features.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="p-1 bg-green-500/20 rounded-full">
                      <Check size={14} className="text-green-400" />
                    </div>
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Clock size={16} />
                  <span>Ежемесячная подписка</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Shield size={16} />
                  <span>Автопродление можно отключить</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Промокод</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoValidation(null);
                      }}
                      placeholder="Введите промокод"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={validatePromoCode}
                    disabled={validatingPromo || !promoCode.trim()}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
                  >
                    {validatingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : "Применить"}
                  </button>
                </div>
                {promoValidation && (
                  <div className={`mt-3 p-3 rounded-lg ${promoValidation.valid ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                    {promoValidation.valid ? (
                      <p className="text-green-400 text-sm">
                        Скидка {promoValidation.discount_percent}% применена!
                      </p>
                    ) : (
                      <p className="text-red-400 text-sm">{promoValidation.error || "Промокод недействителен"}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Способ оплаты</h3>
                <div className="space-y-3">
                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "card" 
                        ? "border-purple-500 bg-purple-500/10" 
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                      className="sr-only"
                    />
                    <CreditCard className={paymentMethod === "card" ? "text-purple-400" : "text-gray-500"} size={24} />
                    <div>
                      <p className="text-white font-medium">Банковская карта</p>
                      <p className="text-gray-400 text-sm">Visa, Mastercard, МИР</p>
                    </div>
                  </label>
                  
                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "sbp" 
                        ? "border-purple-500 bg-purple-500/10" 
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "sbp"}
                      onChange={() => setPaymentMethod("sbp")}
                      className="sr-only"
                    />
                    <Wallet className={paymentMethod === "sbp" ? "text-purple-400" : "text-gray-500"} size={24} />
                    <div>
                      <p className="text-white font-medium">СБП</p>
                      <p className="text-gray-400 text-sm">Система быстрых платежей</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Стоимость плана</span>
                  <span className="text-white">{plan?.base_price_rub} ₽</span>
                </div>
                {promoValidation?.valid && (
                  <div className="flex justify-between items-center mb-2 text-green-400">
                    <span>Скидка по промокоду</span>
                    <span>-{plan!.base_price_rub - finalPrice} ₽</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-lg">Итого</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
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
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30"
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

              <p className="text-center text-gray-500 text-sm">
                Нажимая кнопку, вы соглашаетесь с условиями подписки
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
