import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Key, Check, Shield, Ban, Sparkles, Clock, Star, Crown, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';

interface LicensePricing {
  type: string;
  duration_days: number;
  price_rub: number;
  price_usd: number;
  label: string;
  label_ru: string;
  description: string;
  description_ru: string;
  popular: boolean;
}

const pricingTiers: LicensePricing[] = [
  {
    type: "MONTHLY",
    duration_days: 30,
    price_rub: 50,
    price_usd: 1.00,
    label: "Monthly",
    label_ru: "Месячная",
    description: "30 days of full access",
    description_ru: "30 дней полного доступа",
    popular: false,
  },
  {
    type: "QUARTERLY",
    duration_days: 90,
    price_rub: 125,
    price_usd: 1.50,
    label: "Quarterly",
    label_ru: "Квартальная",
    description: "90 days of full access",
    description_ru: "90 дней полного доступа",
    popular: true,
  },
  {
    type: "YEARLY",
    duration_days: 365,
    price_rub: 500,
    price_usd: 7.00,
    label: "Yearly",
    label_ru: "Годовая",
    description: "365 days of full access",
    description_ru: "365 дней полного доступа",
    popular: false,
  },
];

const benefits = [
  { icon: Check, text: "Полный доступ к регистрации и авторизации" },
  { icon: Ban, text: "Без системной рекламы от Nebula" },
  { icon: Shield, text: "Защищённый доступ к платформе" },
  { icon: Sparkles, text: "Все функции без ограничений" },
];

export default function LicenseActivationPage() {
  const [, setLocation] = useLocation();
  const enableDemoMode = useStore((s) => s.enableDemoMode);
  const [licenseKey, setLicenseKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedTier, setSelectedTier] = useState<LicensePricing | null>(null);

  const formatKey = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = [];
    
    if (cleaned.length > 0) parts.push(cleaned.slice(0, 5));
    if (cleaned.length > 5) parts.push(cleaned.slice(5, 10));
    if (cleaned.length > 10) parts.push(cleaned.slice(10, 15));
    if (cleaned.length > 15) parts.push(cleaned.slice(15, 20));
    
    return parts.join('-');
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatKey(e.target.value);
    setLicenseKey(formatted);
    setError('');
  };

  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < 23) {
      setError('Введите корректный ключ лицензии');
      return;
    }

    if (!licenseKey.startsWith('NEMKS-')) {
      setError('Ключ должен начинаться с NEMKS-');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const validateResponse = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: licenseKey }),
      });

      if (validateResponse.status === 503) {
        setError('Сервер загружается, подождите несколько секунд и попробуйте снова...');
        setIsValidating(false);
        return;
      }

      const validateData = await validateResponse.json();

      if (!validateData.valid) {
        setError(validateData.error || 'Недействительный ключ лицензии');
        setIsValidating(false);
        return;
      }

      localStorage.setItem('pendingLicenseKey', licenseKey);
      setSuccess(true);
      setTimeout(() => {
        setLocation('/auth');
      }, 1500);
    } catch {
      setError('Ошибка при проверке ключа. Попробуйте обновить страницу.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePurchase = (tier: LicensePricing) => {
    setSelectedTier(tier);
  };

  const handleDemoMode = () => {
    enableDemoMode();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-accent grid place-items-center">
              <Key className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-[-0.025em] text-graphite-900">Активация лицензии</h1>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2 mt-3">
            Для доступа к платформе Nebula необходима действующая лицензия.
            Выберите подходящий тариф или активируйте имеющийся ключ.
          </p>
        </motion.div>

        <div className="max-w-[440px] mx-auto space-y-6 sm:space-y-8">
          {/* Ввод ключа - первым */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card shadow-soft p-5 sm:p-8"
          >
            <h2 className="text-lg sm:text-xl font-display font-bold text-graphite-900 mb-4 sm:mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
              Активировать ключ
            </h2>

            <p className="text-muted-foreground text-sm mb-4 sm:mb-6">
              Если у вас уже есть ключ лицензии, введите его ниже для активации.
            </p>

            {/* Тестовый ключ */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-accent rounded-lg border border-emerald-200">
              <p className="text-xs sm:text-sm text-accent-foreground mb-2">
                Пробный ключ (25 дней Premium, однократная активация):
              </p>
              <button
                onClick={() => setLicenseKey('NEMKS-TEST0-TEST0-TEST0')}
                className="w-full py-2 sm:py-3 bg-card hover:bg-emerald-100 rounded-lg border border-emerald-200 font-mono text-sm sm:text-base text-primary tracking-[0.15em] transition-all duration-150 flex items-center justify-center gap-2"
              >
                <span>NEMKS-TEST0-TEST0-TEST0</span>
                <span className="text-xs text-muted-foreground font-sans tracking-normal">(нажмите для вставки)</span>
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Ключ лицензии</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleKeyChange}
                  placeholder="NEMKS-XXXXX-XXXXX-XXXXX"
                  maxLength={23}
                  className="input-field h-12 font-mono text-base tracking-[0.15em] text-center uppercase"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="p-4 bg-danger-soft border border-destructive/20 rounded-lg text-destructive text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="p-5 bg-accent border border-emerald-200 rounded-xl text-center"
                >
                  <Check className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-900">
                    Ключ проверен! После регистрации лицензия будет активирована.
                  </p>
                </motion.div>
              )}

              <button
                onClick={handleActivate}
                disabled={isValidating || licenseKey.length < 23}
                className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Активировать
                  </>
                )}
              </button>

              <button
                onClick={handleDemoMode}
                className="w-full h-9 px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
              >
                Продолжить без ключа — демо-режим
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-muted-foreground text-xs sm:text-sm text-center">
                Формат ключа: <code className="font-mono text-primary text-xs sm:text-sm">NEMKS-XXXXX-XXXXX-XXXXX</code>
              </p>
            </div>

            <div className="mt-4 p-3 sm:p-4 bg-accent rounded-lg border border-emerald-200">
              <p className="text-accent-foreground text-xs sm:text-sm text-center">
                Уже есть аккаунт с лицензией?{' '}
                <button
                  onClick={() => setLocation('/auth')}
                  className="text-primary hover:underline underline-offset-4 font-medium"
                >
                  Войти
                </button>
              </p>
            </div>
          </motion.div>

          {/* Разделитель */}
          <div className="flex items-center gap-3 text-xs text-graphite-400">
            <span className="flex-1 h-px bg-border" />
            <span className="whitespace-nowrap">или купите лицензию</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* Выбор тарифа - вторым */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card shadow-soft p-5 sm:p-8"
          >
            <h2 className="text-lg sm:text-xl font-display font-bold text-graphite-900 mb-4 sm:mb-6 flex items-center gap-2">
              <Crown className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
              Выберите тариф
            </h2>

            <div className="space-y-3">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.type}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.24 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => handlePurchase(tier)}
                  className={`relative p-4 sm:p-5 rounded-xl cursor-pointer transition-all duration-150 border ${
                    selectedTier?.type === tier.type
                      ? 'bg-accent border-primary shadow-soft'
                      : 'bg-card border-border hover:border-emerald-200 hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-elev'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full text-[11px] font-semibold shadow-soft">
                      ПОПУЛЯРНЫЙ
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-graphite-900">{tier.label_ru}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {tier.duration_days} дней
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl sm:text-2xl font-display font-extrabold tracking-[-0.02em] text-graphite-900">{tier.price_rub}₽</p>
                      <p className="text-muted-foreground text-xs sm:text-sm">${tier.price_usd}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {selectedTier && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 sm:mt-6"
              >
                <button
                  className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
                >
                  Купить {selectedTier.label_ru.toLowerCase()} лицензию
                </button>
                <p className="text-center text-muted-foreground text-xs sm:text-sm mt-2">
                  Безопасная оплата через YooKassa
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Преимущества */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card shadow-soft p-5 sm:p-6"
          >
            <h3 className="font-semibold text-graphite-900 text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" strokeWidth={1.75} />
              Что включает лицензия:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 text-graphite-700 text-sm">
                  <benefit.icon className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={1.75} />
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
