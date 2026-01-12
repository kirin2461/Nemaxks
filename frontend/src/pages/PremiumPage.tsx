import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { premiumAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import { 
  Crown, Check, Sparkles, Zap, Shield, Star, Gift, Users, 
  Percent, Clock, ChevronDown, ChevronUp, X,
  Rocket, MessageCircle, Video, Palette, TrendingUp, Award,
  BookOpen, Bot
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
  const { user, isAuthenticated } = useStore();
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
      alert("Войдите в аккаунт для покупки подписки");
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
      } else if (data.message) {
        alert(data.message);
      }
    } catch (error) {
      console.error("Failed to purchase:", error);
      alert("Ошибка при оформлении подписки");
    } finally {
      setPurchasing(null);
    }
  };

  const handleStartTrial = async () => {
    if (!isAuthenticated) {
      alert("Войдите в аккаунт для активации пробного периода");
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
        alert(data.error);
      } else {
        alert("Пробный период активирован! Наслаждайтесь 7 днями Premium бесплатно.");
        window.location.reload();
      }
    } catch (error) {
      alert("Ошибка активации пробного периода");
    } finally {
      setStartingTrial(false);
    }
  };

  const handlePurchaseGift = async (planSlug: string) => {
    if (!giftRecipient) {
      alert("Укажите получателя подарка");
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
        alert(data.error);
      }
    } catch (error) {
      alert("Ошибка при покупке подарка");
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
        alert(data.error);
      } else {
        alert(`Подарок активирован! План: ${data.plan}`);
        window.location.reload();
      }
    } catch (error) {
      alert("Ошибка активации подарка");
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 mb-6">
            <Crown className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-500 font-medium">Nemaks Premium</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            <span className="gradient-text">Раскройте весь потенциал</span>
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

        {userPremium?.has_premium && (
          <Card className="cosmic-border p-6 mb-8 bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
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
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        )}

        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <Crown className="w-6 h-6 text-yellow-500" />
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
                  "cosmic-border relative overflow-hidden transition-all hover:scale-[1.02]",
                  isPro && "ring-2 ring-blue-500/50",
                  isPremium && "ring-2 ring-purple-500/50"
                )}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-bl-lg">
                    Популярный
                  </div>
                )}
                {isPremium && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-bl-lg">
                    Максимум
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    {isStart && <Zap className="w-5 h-5 text-green-500" />}
                    {isPro && <Star className="w-5 h-5 text-blue-500" />}
                    {isPremium && <Crown className="w-5 h-5 text-purple-500" />}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold">
                      {plan.base_price_rub > 0 ? `${plan.base_price_rub}₽` : "Бесплатно"}
                    </span>
                    {plan.base_price_rub > 0 && <span className="text-muted-foreground">/мес</span>}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                    {plan.description}
                  </p>
                    
                    <ul className="space-y-2 mb-6 text-sm">
                      <li className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span>Видео: {plan.video_retention_days} дней</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>Сообщения: {plan.messages_retention_days} дней</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span>Jarvis AI: {plan.jarvis_daily_limit}/день</span>
                      </li>
                      {plan.boards_persist_flag && (
                        <li className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>Интерактивные доски и тетради</span>
                        </li>
                      )}
                      {plan.overage_storage_enabled && (
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>Докупка хранилища (50₽/ГБ)</span>
                        </li>
                      )}
                      {plan.traffic_reports_enabled && (
                        <li className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                          <span>Отчёты по трафику</span>
                        </li>
                      )}
                    </ul>
                    
                    <Button
                      className={cn(
                        "w-full",
                        isStart && "bg-green-600 hover:bg-green-700",
                        isPro && "bg-gradient-to-r from-blue-500 to-cyan-500",
                        isPremium && "bg-gradient-to-r from-purple-500 to-pink-500"
                      )}
                      onClick={() => {
                        if (!isAuthenticated) {
                          alert("Войдите в аккаунт");
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

          <Card className="cosmic-border p-6 mt-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Для организаций: seat-based биллинг</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Для планов Про и Премиум дополнительно оплачиваются места участников
              </p>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">35₽</div>
                  <div className="text-sm text-muted-foreground">Студент-редактор/мес</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">500₽</div>
                  <div className="text-sm text-muted-foreground">Преподаватель/мес</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">0₽</div>
                  <div className="text-sm text-muted-foreground">Читатель</div>
                </div>
              </div>
            </div>
          </Card>

        <Card className="cosmic-border p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Percent className="w-5 h-5 text-green-500" />
                Промокод
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Введите код"
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                />
                <Button onClick={handleValidatePromo} loading={validatingPromo} variant="secondary">
                  Применить
                </Button>
              </div>
              {promoValidation && (
                <div className={cn(
                  "mt-2 text-sm",
                  promoValidation.valid ? "text-green-500" : "text-red-500"
                )}>
                  {promoValidation.valid 
                    ? `Скидка ${promoValidation.discount_percent || promoValidation.discount_amount}${promoValidation.discount_percent ? '%' : '₽'} применена!`
                    : promoValidation.error}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-pink-500" />
                Активировать подарок
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="GIFT-XXXXXXXX"
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
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
              <div key={i} className="p-5 rounded-xl bg-card/50 border border-border/50 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
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
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowFAQ(showFAQ === i ? null : i)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-card/50 transition-colors"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md cosmic-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-500" />
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
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Сообщение (необязательно)</label>
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Поздравляю!"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none resize-none"
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
                        plan.slug === "pro" && "bg-gradient-to-r from-blue-500 to-cyan-500",
                        plan.slug === "premium" && "bg-gradient-to-r from-purple-500 to-pink-500"
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
