import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Key, Check, Shield, Ban, Sparkles, Clock, Star, Crown } from 'lucide-react';
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
    <div className="min-h-screen bg-nebula text-foreground">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 sm:mb-12"
        >
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Key className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-2xl sm:text-4xl font-bold gradient-brand-text">Активация лицензии</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Для доступа к платформе Nebula необходима действующая лицензия.
            Выберите подходящий тариф или активируйте имеющийся ключ.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
          {/* Ввод ключа - первым */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-xl sm:rounded-2xl p-4 sm:p-8"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Активировать ключ
            </h2>

            <p className="text-muted-foreground text-sm sm:text-base mb-4 sm:mb-6">
              Если у вас уже есть ключ лицензии, введите его ниже для активации.
            </p>

            {/* Тестовый ключ */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-primary/10 rounded-lg sm:rounded-xl border border-primary/30">
              <p className="text-xs sm:text-sm text-foreground mb-2">
                Пробный ключ (25 дней Premium, однократная активация):
              </p>
              <button
                onClick={() => setLicenseKey('NEMKS-TEST0-TEST0-TEST0')}
                className="w-full py-2 sm:py-3 bg-background/50 hover:bg-primary/10 rounded-lg font-mono text-sm sm:text-lg text-primary tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <span>NEMKS-TEST0-TEST0-TEST0</span>
                <span className="text-xs text-muted-foreground">(нажмите для вставки)</span>
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Ключ лицензии</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleKeyChange}
                  placeholder="NEMKS-XXXXX-XXXXX-XXXXX"
                  maxLength={23}
                  className="input-field !rounded-lg sm:!rounded-xl text-center text-base sm:text-xl font-mono tracking-wider uppercase py-3 sm:py-4"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-accent/15 border border-accent/40 rounded-xl text-accent text-center"
                >
                  Ключ проверен! После регистрации лицензия будет активирована.
                </motion.div>
              )}

              <button
                onClick={handleActivate}
                disabled={isValidating || licenseKey.length < 23}
                className="w-full py-3 sm:py-4 gradient-brand rounded-lg sm:rounded-xl font-bold text-base sm:text-lg text-primary-foreground shadow-soft hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    Активировать
                  </>
                )}
              </button>

              <button
                onClick={handleDemoMode}
                className="w-full py-2 text-sm text-white/50 hover:text-white transition-colors"
              >
                Продолжить без ключа — демо-режим
              </button>
            </div>

            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border">
              <p className="text-muted-foreground text-xs sm:text-sm text-center">
                Формат ключа: <code className="text-primary text-xs sm:text-sm">NEMKS-XXXXX-XXXXX-XXXXX</code>
              </p>
            </div>

            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-accent/10 rounded-lg sm:rounded-xl border border-accent/30">
              <p className="text-accent text-xs sm:text-sm text-center">
                Уже есть аккаунт с лицензией?{' '}
                <button
                  onClick={() => setLocation('/auth')}
                  className="text-accent hover:underline font-medium"
                >
                  Войти
                </button>
              </p>
            </div>
          </motion.div>

          {/* Разделитель */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1 h-px bg-secondary" />
            <span className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">или купите лицензию</span>
            <div className="flex-1 h-px bg-secondary" />
          </div>

          {/* Выбор тарифа - вторым */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-strong rounded-xl sm:rounded-2xl p-4 sm:p-8"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Выберите тариф
            </h2>

            <div className="space-y-3 sm:space-y-4">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  onClick={() => handlePurchase(tier)}
                  className={`relative p-4 sm:p-5 rounded-lg sm:rounded-xl cursor-pointer transition-all ${
                    selectedTier?.type === tier.type
                      ? 'bg-primary/15 border-2 border-primary glow'
                      : 'bg-background/40 border-2 border-border hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 px-2 sm:px-3 py-0.5 sm:py-1 gradient-brand text-primary-foreground rounded-full text-[10px] sm:text-xs font-bold shadow-soft">
                      ПОПУЛЯРНЫЙ
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold">{tier.label_ru}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        {tier.duration_days} дней
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl sm:text-2xl font-bold gradient-brand-text">{tier.price_rub}₽</p>
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
                  className="w-full py-3 sm:py-4 gradient-brand rounded-lg sm:rounded-xl font-bold text-base sm:text-lg text-primary-foreground shadow-glow hover:brightness-110 transition-all"
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-soft"
          >
            <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Что включает лицензия:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 text-foreground text-sm">
                  <benefit.icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent flex-shrink-0" />
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
