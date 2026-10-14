import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { premiumAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { 
  Crown, Check, Sparkles, Zap, Shield, Star, Gift, Users,
  Percent, Clock, ChevronDown, ChevronUp, X,
  Rocket, MessageCircle, Video, Palette, TrendingUp, Award,
  BookOpen, Bot, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPremium {
  has_premium: boolean;
  plan_name?: string;
  expires_at?: string;
  auto_renew?: boolean;
}

interface PromoValidation {
  valid: boolean;
  code?: string;
  discount_percent?: number;
  discount_amount?: number;
  error?: string;
}

interface OrgPlan {
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

export default function PremiumPage() {
  const { user, isAuthenticated, checkAuth } = useStore();
  const toast = useToast();
  const [orgPlans, setOrgPlans] = useState<OrgPlan[]>([]);
  const [userPremium, setUserPremium] = useState<UserPremium | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoValidation, setPromoValidation] = useState<PromoValidation | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [showFAQ, setShowFAQ] = useState<number | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);
  const [testModeSuccess, setTestModeSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [premiumData, orgPlansData] = await Promise.all([
          isAuthenticated && user?.id ? premiumAPI.getUserPremium(String(user.id)) : null,
          fetch("/api/subscription-plans").then(r => r.ok ? r.json() : []),
        ]);
        setUserPremium(premiumData);
        setOrgPlans(orgPlansData || []);
      } catch (error) {
        console.error("Failed to load premium data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isAuthenticated, user?.id]);

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const response = await fetch(`/api/promo/validate?code=${encodeURIComponent(promoCode)}`);
      const data = await response.json();
      setPromoValidation(data);
    } catch (error) {
      setPromoValidation({ valid: false, error: "Ошибка проверки кода" });
    } finally {
      setValidatingPromo(false);
    }
  };

  const handlePurchase = async (planSlug: string) => {
    if (!isAuthenticated) {
      toast.warning("Войдите в аккаунт для покупки подписки");
      return;
    }
    
    setPurchasing(planSlug);
    try {
      const response = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ 
          plan_slug: planSlug,
          promo_code: promoValidation?.valid ? promoCode : undefined
        }),
      });
      const data = await response.json();
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else if (data.test_mode) {
        setTestModeSuccess(data.message || "Тестовый платёж: подписка активирована");
        checkAuth().catch(() => {});
        setTimeout(() => {
          window.location.href = "/premium";
        }, 1500);
      } else if (data.message) {
        toast.info(data.message);
      }
    } catch (error) {
      console.error("Failed to purchase:", error);
      toast.error("Ошибка при оформлении подписки");
    } finally {
      setPurchasing(null);
    }
  };

  const handleStartTrial = async () => {
    if (!isAuthenticated) {
      toast.warning("Войдите в аккаунт для активации пробного периода");
      return;
    }
    setStartingTrial(true);
    try {
      const response = await fetch("/api/premium/trial", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Пробный период активирован!", "Наслаждайтесь 7 днями Premium бесплатно");
        window.location.reload();
      }
    } catch (error) {
      toast.error("Ошибка активации пробного периода");
    } finally {
      setStartingTrial(false);
    }
  };

  const handlePurchaseGift = async (planSlug: string) => {
    if (!giftRecipient) {
      toast.warning("Укажите получателя подарка");
      return;
    }
    setPurchasing(planSlug);
    try {
      const response = await fetch("/api/gifts/purchase", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ 
          plan_slug: planSlug,
          to_username: giftRecipient,
          message: giftMessage
        }),
      });
      const data = await response.json();
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Ошибка при покупке подарка");
    } finally {
      setPurchasing(null);
      setShowGiftModal(false);
    }
  };

  const handleRedeemGift = async () => {
    if (!redeemCode.trim()) return;
    try {
      const response = await fetch("/api/gifts/redeem", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ code: redeemCode }),
      });
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Подарок активирован!", `План: ${data.plan}`);
        window.location.reload();
      }
    } catch (error) {
      toast.error("Ошибка активации подарка");
    }
  };

  const getPaidPlans = () => orgPlans.filter(p => p.base_price_rub > 0);

  const allFeatures = [
    { icon: MessageCircle, title: "Безлимитные сообщения", desc: "Никаких ограничений на общение" },
    { icon: Video, title: "HD видеозвонки", desc: "Кристально чистое качество" },
    { icon: Palette, title: "Эксклюзивные темы", desc: "Уникальное оформление профиля" },
    { icon: TrendingUp, title: "Буст постов", desc: "Продвигайте контент со скидкой 20%" },
    { icon: Award, title: "Premium значок", desc: "Выделяйтесь среди пользователей" },
    { icon: Rocket, title: "Ранний доступ", desc: "Первыми получайте новые функции" },
  ];

  const faqItems = [
    { q: "Как работает автопродление?", a: "Подписка автоматически продлевается в день окончания. Вы можете отключить автопродление в любой момент в настройках." },
    { q: "Можно ли вернуть деньги?", a: "Да, возврат возможен в течение 14 дней после покупки, если вы не использовали Premium функции." },
    { q: "Что такое пробный период?", a: "7 дней бесплатного доступа ко всем Premium функциям. Доступен один раз для новых пользователей." },
    { q: "Как подарить подписку?", a: "Нажмите кнопку 'Подарить', выберите план и укажите имя получателя. Он получит код активации." },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 glow mb-6">
            <Crown className="w-5 h-5 text-primary" />
            <span className="gradient-brand-text font-medium">Nebula Premium</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            <span className="gradient-brand-text">Раскройте весь потенциал</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
            Эксклюзивные функции, приоритетная поддержка и уникальные возможности для продвинутых пользователей
          </p>

          {!userPremium?.has_premium && (
            <Button
              onClick={handleStartTrial}
              loading={startingTrial}
              variant="secondary"
              className="border-primary/50 hover:bg-primary/10"
            >
              <Clock className="w-4 h-4 mr-2" />
              Попробовать 7 дней бесплатно
            </Button>
          )}
        </div>

        {testModeSuccess && (
          <Card className="glass rounded-xl p-6 mb-8 shadow-soft border border-emerald-500/30 bg-emerald-500/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-emerald-300">Подписка активирована (тестовый режим)</h3>
                <p className="text-muted-foreground">{testModeSuccess}</p>
                <p className="text-sm text-emerald-400 mt-1">Перенаправление...</p>
              </div>
            </div>
          </Card>
        )}

        {userPremium?.has_premium && (
          <Card className="glass rounded-xl p-6 mb-8 shadow-soft">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-brand flex items-center justify-center glow">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Подписка {userPremium.plan_name} активна</h3>
                {userPremium.expires_at && (
                  <p className="text-muted-foreground">
                    Действует до {new Date(userPremium.expires_at).toLocaleDateString("ru-RU")}
                    {userPremium.auto_renew && " • Автопродление включено"}
                  </p>
                )}
              </div>
              <Shield className="w-8 h-8 text-accent" />
            </div>
          </Card>
        )}

        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <Crown className="w-6 h-6 text-primary" />
          Выберите подписку
        </h2>
        <p className="text-muted-foreground text-center mb-8">
          Единые тарифы для пользователей и организаций
        </p>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {orgPlans.map((plan) => {
            const isStart = plan.slug === "start";
            const isPro = plan.slug === "pro";
            const isPremium = plan.slug === "premium";
            
            return (
              <Card
                key={plan.id}
                className={cn(
                  "glass rounded-xl relative overflow-hidden transition-all hover:scale-[1.02] shadow-soft",
                  isPro && "ring-2 ring-accent/50 glow",
                  isPremium && "ring-2 ring-primary/50 glow"
                )}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 px-3 py-1 gradient-brand text-primary-foreground text-xs font-medium rounded-bl-lg">
                    Популярный
                  </div>
                )}
                {isPremium && (
                  <div className="absolute top-0 right-0 px-3 py-1 gradient-brand text-primary-foreground text-xs font-medium rounded-bl-lg">
                    Максимум
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    {isStart && <Zap className="w-5 h-5 text-accent" />}
                    {isPro && <Star className="w-5 h-5 text-accent" />}
                    {isPremium && <Crown className="w-5 h-5 text-primary" />}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold gradient-brand-text">
                      {plan.base_price_rub > 0 ? `${plan.base_price_rub}₽` : "Бесплатно"}
                    </span>
                    {plan.base_price_rub > 0 && <span className="text-muted-foreground">/мес</span>}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                    {plan.description}
                  </p>
                    
                    <ul className="space-y-2 mb-6 text-sm">
                      <li className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-accent flex-shrink-0" />
                        <span>Видео: {plan.video_retention_days} дней</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>Сообщения: {plan.messages_retention_days} дней</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-accent flex-shrink-0" />
                        <span>Jarvis AI: {plan.jarvis_daily_limit}/день</span>
                      </li>
                      {plan.boards_persist_flag && (
                        <li className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>Интерактивные доски и тетради</span>
                        </li>
                      )}
                      {plan.overage_storage_enabled && (
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-accent flex-shrink-0" />
                          <span>Докупка хранилища (50₽/ГБ)</span>
                        </li>
                      )}
                      {plan.traffic_reports_enabled && (
                        <li className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-accent flex-shrink-0" />
                          <span>Отчёты по трафику</span>
                        </li>
                      )}
                    </ul>
                    
                    <Button
                      className={cn(
                        "w-full",
                        isStart && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                        (isPro || isPremium) && "glow"
                      )}
                      onClick={() => {
                        if (!isAuthenticated) {
                          toast.warning("Войдите в аккаунт");
                          return;
                        }
                        if (isStart) {
                          window.location.href = "/templates";
                        } else {
                          window.location.href = `/premium/checkout?plan=${plan.slug}`;
                        }
                      }}
                    >
                      {isStart ? "Начать бесплатно" : "Оформить подписку"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="glass rounded-xl p-6 mt-6 shadow-soft">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Для организаций: seat-based биллинг</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Для планов Про и Премиум дополнительно оплачиваются места участников
              </p>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">35₽</div>
                  <div className="text-sm text-muted-foreground">Студент-редактор/мес</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">500₽</div>
                  <div className="text-sm text-muted-foreground">Преподаватель/мес</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-brand-text">0₽</div>
                  <div className="text-sm text-muted-foreground">Читатель</div>
                </div>
              </div>
            </div>
          </Card>

        <Card className="glass rounded-xl p-6 mb-8 shadow-soft">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Percent className="w-5 h-5 text-accent" />
                Промокод
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Введите код"
                  className="input-field flex-1"
                />
                <Button onClick={handleValidatePromo} loading={validatingPromo} variant="secondary">
                  Применить
                </Button>
              </div>
              {promoValidation && (
                <div className={cn(
                  "mt-2 text-sm",
                  promoValidation.valid ? "text-accent" : "text-red-400"
                )}>
                  {promoValidation.valid 
                    ? `Скидка ${promoValidation.discount_percent || promoValidation.discount_amount}${promoValidation.discount_percent ? '%' : '₽'} применена!`
                    : promoValidation.error}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Активировать подарок
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="GIFT-XXXXXXXX"
                  className="input-field flex-1"
                />
                <Button onClick={handleRedeemGift} variant="secondary">
                  Активировать
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-center gap-4 mb-12">
          <Button onClick={() => setShowGiftModal(true)} variant="secondary" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Подарить Premium
          </Button>
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => window.location.href = '/referrals'}>
            <Users className="w-4 h-4" />
            Пригласить друзей (+7 дней)
          </Button>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">Все преимущества Premium</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allFeatures.map((feature, i) => (
              <div key={i} className="p-5 rounded-xl glass shadow-soft flex items-start gap-4 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-6">Частые вопросы</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowFAQ(showFAQ === i ? null : i)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-primary/5 transition-colors"
                >
                  <span className="font-medium">{item.q}</span>
                  {showFAQ === i ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {showFAQ === i && (
                  <div className="px-4 pb-4 text-muted-foreground">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Оплата производится через YooKassa. Подписка продлевается автоматически.</p>
          <p>Отменить подписку можно в любой момент в настройках аккаунта.</p>
        </div>

        {showGiftModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  Подарить Premium
                </h3>
                <button onClick={() => setShowGiftModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Имя получателя</label>
                  <input
                    type="text"
                    value={giftRecipient}
                    onChange={(e) => setGiftRecipient(e.target.value)}
                    placeholder="username"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Сообщение (необязательно)</label>
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Поздравляю!"
                    rows={2}
                    className="input-field resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  {getPaidPlans().map((plan) => (
                    <Button
                      key={plan.slug}
                      onClick={() => handlePurchaseGift(plan.slug)}
                      loading={purchasing === plan.slug}
                      className={cn(
                        "w-full",
                        (plan.slug === "pro" || plan.slug === "premium") && "glow"
                      )}
                    >
                      Подарить {plan.name} ({plan.base_price_rub}₽)
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
