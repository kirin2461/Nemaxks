import { useState, useEffect } from 'react';
import { challengesAPI, streaksAPI, currencyAPI, Challenge, UserStreak, VirtualCurrency } from '../lib/api';
import { Target, Flame, Gift, Check, Clock, Coins, Gem, Zap, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

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
    { id: 'daily', label: 'Ежедневные', icon: <Calendar className="w-4 h-4" /> },
    { id: 'weekly', label: 'Еженедельные', icon: <Target className="w-4 h-4" /> },
    { id: 'special', label: 'Особые', icon: <Zap className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary/40 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold text-foreground">Задания</h1>
          </div>
          
          {currency && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-accent/15 px-4 py-2 rounded-lg">
                <Coins className="w-5 h-5 text-accent" />
                <span className="text-accent font-semibold">{currency.coins}</span>
              </div>
              <div className="flex items-center gap-2 bg-primary/15 px-4 py-2 rounded-lg">
                <Gem className="w-5 h-5 text-primary" />
                <span className="text-primary font-semibold">{currency.gems}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-accent/20 to-red-500/20 rounded-xl p-6 border border-accent/30">
            <div className="flex items-center gap-3 mb-4">
              <Flame className="w-8 h-8 text-accent" />
              <div>
                <h3 className="text-xl font-bold text-foreground">Серия входов</h3>
                <p className="text-accent/80">{streak?.login_streak || 0} дней подряд</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Рекорд: {streak?.max_login_streak || 0} дней
              </div>
              <button
                onClick={handleClaimDaily}
                disabled={claimedToday}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                  claimedToday
                    ? 'bg-green-500/20 text-green-400 cursor-default'
                    : 'bg-accent hover:bg-accent/80 text-white'
                }`}
              >
                {claimedToday ? (
                  <>
                    <Check className="w-4 h-4" />
                    Получено
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    Забрать
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl p-6 border border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                🎰
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Колесо удачи</h3>
                <p className="text-primary/80">Испытай удачу!</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                Стоимость: <Coins className="w-4 h-4 text-accent" /> 25
              </div>
              <button
                onClick={handleSpinWheel}
                disabled={!currency || currency.coins < 25 || wheelSpinning}
                className="px-4 py-2 rounded-lg font-medium bg-primary hover:bg-primary/80 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {wheelSpinning ? 'Крутится...' : 'Крутить'}
              </button>
            </div>
            {lastPrize && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-green-500/20 rounded-lg text-center"
              >
                <p className="text-green-400 font-medium">🎉 {lastPrize.name}</p>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {challenges.map((challenge) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-card/50 rounded-xl p-4 border ${
                challenge.is_completed ? 'border-green-500/50' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {challenge.is_completed ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h3 className="text-lg font-semibold text-foreground">
                      {challenge.name_ru || challenge.name}
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">
                    {challenge.description_ru || challenge.description}
                  </p>
                  
                  <div className="w-full bg-secondary rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        challenge.is_completed ? 'bg-green-500' : 'bg-accent'
                      }`}
                      style={{ width: `${Math.min(100, ((challenge.progress || 0) / challenge.target) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {challenge.progress || 0} / {challenge.target}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="flex items-center gap-2">
                    {challenge.xp_reward > 0 && (
                      <span className="text-sm text-primary flex items-center gap-1">
                        <Zap className="w-4 h-4" /> {challenge.xp_reward} XP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {challenge.coin_reward > 0 && (
                      <span className="text-sm text-accent flex items-center gap-1">
                        <Coins className="w-4 h-4" /> {challenge.coin_reward}
                      </span>
                    )}
                    {challenge.gem_reward > 0 && (
                      <span className="text-sm text-primary flex items-center gap-1">
                        <Gem className="w-4 h-4" /> {challenge.gem_reward}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {challenges.length === 0 && (
          <div className="text-center py-16">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Нет доступных заданий</p>
          </div>
        )}
      </div>
    </div>
  );
}
