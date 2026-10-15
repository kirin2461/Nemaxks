import { useState, useEffect } from 'react';
import { challengesAPI, streaksAPI, currencyAPI, Challenge, UserStreak, VirtualCurrency } from '../lib/api';
import { Target, Flame, Gift, Check, Clock, Coins, Gem, Zap, Calendar } from 'lucide-react';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [currency, setCurrency] = useState<VirtualCurrency | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'special'>('daily');
  const [loading, setLoading] = useState(true);
  const [claimedToday, setClaimedToday] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [lastPrize, setLastPrize] = useState<{ name: string; coins: number; gems: number; xp: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      const [challengesData, streakData, currencyData] = await Promise.all([
        challengesAPI.getAll(activeTab),
        streaksAPI.get(),
        currencyAPI.get(),
      ]);
      setChallenges(challengesData || []);
      setStreak(streakData);
      setCurrency(currencyData);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDaily = async () => {
    try {
      const result = await streaksAPI.claimDailyReward();
      if (result.claimed) {
        setClaimedToday(true);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to claim daily reward:', err);
    }
  };

  const handleSpinWheel = async () => {
    if (!currency || currency.coins < 25 || wheelSpinning) return;
    setWheelSpinning(true);
    try {
      const result = await streaksAPI.spinWheel();
      setLastPrize(result.prize);
      setCurrency(result.balance);
      setTimeout(() => {
        setWheelSpinning(false);
        setLastPrize(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to spin wheel:', err);
      setWheelSpinning(false);
    }
  };

  const tabs = [
    { id: 'daily', label: 'Ежедневные', icon: <Calendar className="w-4 h-4" strokeWidth={1.75} /> },
    { id: 'weekly', label: 'Еженедельные', icon: <Target className="w-4 h-4" strokeWidth={1.75} /> },
    { id: 'special', label: 'Особые', icon: <Zap className="w-4 h-4" strokeWidth={1.75} /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-56 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton h-36 rounded-xl" />
            <div className="skeleton h-36 rounded-xl" />
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            <div>
              <h1 className="text-2xl font-display font-bold text-graphite-900">Задания</h1>
              <p className="text-sm text-muted-foreground">Ежедневные и еженедельные испытания</p>
            </div>
          </div>

          {currency && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                <Coins className="w-4 h-4 text-graphite-600" strokeWidth={1.75} />
                <span className="font-mono">{currency.coins}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
                <Gem className="w-4 h-4" strokeWidth={1.75} />
                <span className="font-mono">{currency.gems}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in" style={{ animationDelay: '40ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-accent grid place-items-center">
                <Flame className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-graphite-900">Серия входов</h3>
                <p className="text-sm text-emerald-700 font-medium">{streak?.login_streak || 0} дней подряд</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Рекорд: {streak?.max_login_streak || 0} дней
              </div>
              <button
                onClick={handleClaimDaily}
                disabled={claimedToday}
                className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                  claimedToday
                    ? 'bg-success-soft text-emerald-800 cursor-default'
                    : 'bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand'
                }`}
              >
                {claimedToday ? (
                  <>
                    <Check className="w-4 h-4" strokeWidth={2} />
                    Получено
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" strokeWidth={1.75} />
                    Забрать
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center text-xl">
                🎰
              </div>
              <div>
                <h3 className="text-lg font-semibold text-graphite-900">Колесо удачи</h3>
                <p className="text-sm text-muted-foreground">Испытай удачу!</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                Стоимость: <Coins className="w-4 h-4 text-graphite-600" strokeWidth={1.75} /> 25
              </div>
              <button
                onClick={handleSpinWheel}
                disabled={!currency || currency.coins < 25 || wheelSpinning}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
              >
                {wheelSpinning ? 'Крутится...' : 'Крутить'}
              </button>
            </div>
            {lastPrize && (
              <div className="mt-4 p-3 bg-success-soft rounded-lg text-center animate-scale-in">
                <p className="text-emerald-800 font-medium text-sm">🎉 {lastPrize.name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 border-b border-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4" key={activeTab}>
          {challenges.map((challenge, index) => (
            <div
              key={challenge.id}
              className={`rounded-xl bg-card border shadow-soft p-4 transition-all duration-150 animate-rise-in ${
                challenge.is_completed ? 'bg-accent/30 border-emerald-200' : 'border-border hover:shadow-elev'
              }`}
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {challenge.is_completed ? (
                      <Check className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
                    )}
                    <h3 className="text-base font-semibold text-graphite-900">
                      {challenge.name_ru || challenge.name}
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">
                    {challenge.description_ru || challenge.description}
                  </p>

                  <div className="w-full bg-graphite-200 rounded-full h-2 mb-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full animate-bar-grow origin-left ${
                        challenge.is_completed ? 'bg-emerald-600' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, ((challenge.progress || 0) / challenge.target) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {challenge.progress || 0} / {challenge.target}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {challenge.xp_reward > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                      <Zap className="w-3.5 h-3.5" strokeWidth={1.75} /> {challenge.xp_reward} XP
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {challenge.coin_reward > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-medium">
                        <Coins className="w-3.5 h-3.5 text-graphite-600" strokeWidth={1.75} /> {challenge.coin_reward}
                      </span>
                    )}
                    {challenge.gem_reward > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                        <Gem className="w-3.5 h-3.5" strokeWidth={1.75} /> {challenge.gem_reward}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {challenges.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <Target className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">Нет доступных заданий</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Новые испытания скоро появятся</p>
          </div>
        )}
      </div>
    </div>
  );
}
