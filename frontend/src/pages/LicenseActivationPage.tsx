import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Key, Check, Shield, Ban, Sparkles, Clock, Star, Crown } from 'lucide-react';

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
    price_rub: 600,
    price_usd: 8.00,
    label: "Yearly",
    label_ru: "Годовая",
    description: "365 days of full access",
    description_ru: "365 дней полного доступа",
    popular: false,
  },
];

const benefits = [
  { icon: Check, text: "Полный доступ к регистрации и авторизации" },
  { icon: Ban, text: "Без системной рекламы от Nemaks" },
  { icon: Shield, text: "Защищённый доступ к платформе" },
  { icon: Sparkles, text: "Все функции без ограничений" },
];

export default function LicenseActivationPage() {
  const [, setLocation] = useLocation();
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
      setError('Ошибка при проверке ключа');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePurchase = (tier: LicensePricing) => {
    setSelectedTier(tier);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Key className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold">Активация лицензии</h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Для доступа к платформе Nemaks необходима действующая лицензия.
            Выберите подходящий тариф или активируйте имеющийся ключ.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                Выберите тариф
              </h2>

              <div className="space-y-4">
                {pricingTiers.map((tier, index) => (
                  <motion.div
                    key={tier.type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    onClick={() => handlePurchase(tier)}
                    className={`relative p-5 rounded-xl cursor-pointer transition-all ${
                      selectedTier?.type === tier.type
                        ? 'bg-purple-600/30 border-2 border-purple-500'
                        : 'bg-gray-700/50 border-2 border-transparent hover:border-gray-600'
                    }`}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-bold">
                        ПОПУЛЯРНЫЙ
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{tier.label_ru}</h3>
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {tier.duration_days} дней
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-400">{tier.price_rub}₽</p>
                        <p className="text-gray-500 text-sm">${tier.price_usd}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {selectedTier && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6"
                >
                  <button
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    Купить {selectedTier.label_ru.toLowerCase()} лицензию
                  </button>
                  <p className="text-center text-gray-500 text-sm mt-2">
                    Безопасная оплата через YooKassa
                  </p>
                </motion.div>
              )}
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Что включает лицензия:
              </h3>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3 text-gray-300">
                    <benefit.icon className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span>{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 h-fit"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Key className="w-6 h-6 text-purple-400" />
              Активировать ключ
            </h2>

            <p className="text-gray-400 mb-6">
              Если у вас уже есть ключ лицензии, введите его ниже для активации.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Ключ лицензии</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleKeyChange}
                  placeholder="NEMKS-XXXXX-XXXXX-XXXXX"
                  maxLength={23}
                  className="w-full px-4 py-4 bg-gray-700/50 rounded-xl text-center text-xl font-mono tracking-wider outline-none focus:ring-2 focus:ring-purple-500 uppercase"
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
                  className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 text-center"
                >
                  Ключ проверен! После регистрации лицензия будет активирована.
                </motion.div>
              )}

              <button
                onClick={handleActivate}
                disabled={isValidating || licenseKey.length < 23}
                className="w-full py-4 bg-purple-600 rounded-xl font-bold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Активировать
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-sm text-center">
                Формат ключа: <code className="text-purple-400">NEMKS-XXXXX-XXXXX-XXXXX</code>
              </p>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <p className="text-blue-300 text-sm text-center">
                Уже есть аккаунт с лицензией?{' '}
                <button
                  onClick={() => setLocation('/login')}
                  className="text-blue-400 hover:underline font-medium"
                >
                  Войти
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
