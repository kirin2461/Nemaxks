import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Trophy, Star, Zap, Medal, Crown, TrendingUp, MessageSquare, Mic, Heart, Clock, Check } from 'lucide-react';
import { achievementsAPI, Achievement, UserAchievement, UserLevel, LeaderboardEntry } from '../lib/api';

/* Rarity encoded by border weight + graphite→emerald scale (NO rainbow gradients) */
const rarityBorders: Record<string, string> = {
  common: 'border border-border',
  uncommon: 'border border-graphite-300',
  rare: 'border border-graphite-400',
  epic: 'border-2 border-emerald-300',
  legendary: 'border-2 border-emerald-600 shadow-lg-brand',
};

const rarityBadges: Record<string, string> = {
  common: 'bg-secondary text-secondary-foreground',
  uncommon: 'bg-secondary text-secondary-foreground',
  rare: 'border border-graphite-300 text-graphite-600',
  epic: 'bg-emerald-100 text-emerald-800',
  legendary: 'bg-emerald-600 text-white',
};

const categoryIcons: Record<string, any> = {
  social: MessageSquare,
  voice: Mic,
  content: Heart,
  progression: Star,
  reputation: Medal,
  loyalty: Clock,
};

export default function AchievementsPage() {
  const params = useParams();
  const userId = params.userId || 'me';

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard'>('achievements');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'ru'>('ru');

  useEffect(() => {
    loadData();
  }, [userId, leaderboardPeriod]);

  async function loadData() {
    setLoading(true);
    try {
      const [achData, userAchData, levelData, leaderData] = await Promise.all([
        achievementsAPI.getAll(),
        achievementsAPI.getUserAchievements(userId),
        achievementsAPI.getUserLevel(userId),
        achievementsAPI.getLeaderboard('global', leaderboardPeriod),
      ]);
      setAchievements(achData || []);
      setUserAchievements(userAchData || []);
      setUserLevel(levelData);
      setLeaderboard(leaderData || []);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
    setLoading(false);
  }

  const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-9 w-72 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-6xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">
              {language === 'ru' ? 'Достижения' : 'Achievements'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === 'ru' ? 'Ваш прогресс и награды' : 'Your progress and rewards'}
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setLanguage(l => l === 'ru' ? 'en' : 'ru')}
              className="h-9 px-3 rounded-lg border border-input bg-card text-sm text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97]"
            >
              {language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
            </button>
          </div>
        </div>

        {userLevel && (
          <div className="rounded-xl border border-border bg-card shadow-soft p-6 mb-8 animate-rise-in" style={{ animationDelay: '40ms' }}>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-elev">
                  <span className="text-3xl font-display font-bold">{userLevel.level}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-soft">
                  {language === 'ru' ? 'Уровень' : 'Level'}
                </div>
              </div>

              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                  <span className="text-lg font-semibold text-graphite-900">
                    {userLevel.current_xp.toLocaleString()} / {userLevel.xp_needed.toLocaleString()} XP
                  </span>
                </div>

                <div className="w-full h-2 bg-graphite-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full animate-bar-grow origin-left"
                    style={{ width: `${userLevel.progress}%` }}
                  />
                </div>

                <div className="flex gap-6 mt-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
                    <span>{userLevel.messages} {language === 'ru' ? 'сообщений' : 'messages'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" strokeWidth={1.75} />
                    <span>{userLevel.voice_mins} {language === 'ru' ? 'мин в голосе' : 'voice mins'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" strokeWidth={1.75} />
                    <span>{userLevel.reactions} {language === 'ru' ? 'реакций' : 'reactions'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-display font-bold text-graphite-900">{userLevel.total_xp.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{language === 'ru' ? 'Всего XP' : 'Total XP'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6 border-b border-border mb-6 animate-rise-in" style={{ animationDelay: '80ms' }}>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
              activeTab === 'achievements'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Trophy className="w-4 h-4" strokeWidth={1.75} />
            {language === 'ru' ? 'Достижения' : 'Achievements'}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
              activeTab === 'leaderboard'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
            {language === 'ru' ? 'Лидерборд' : 'Leaderboard'}
          </button>
        </div>

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((ach, index) => {
              const isUnlocked = unlockedIds.has(ach.id);

              return (
                <div
                  key={ach.id}
                  className={`relative rounded-xl bg-card p-4 shadow-soft transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev ${
                    rarityBorders[ach.rarity] || rarityBorders.common
                  } ${isUnlocked ? 'bg-accent/30 border-emerald-200' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-14 w-14 shrink-0 rounded-xl flex items-center justify-center text-[28px] ${
                      isUnlocked ? 'bg-accent text-emerald-600' : 'bg-secondary text-graphite-400 grayscale'
                    }`}>
                      {ach.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-graphite-900">
                        {language === 'ru' ? ach.name_ru : ach.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ru' ? ach.description_ru : ach.description}
                      </p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${rarityBadges[ach.rarity] || rarityBadges.common}`}>
                          {ach.rarity}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                          <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
                          +{ach.xp_reward} XP
                        </span>
                      </div>
                    </div>

                    {isUnlocked && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-scale-in">
                          <Check className="w-4 h-4 text-primary-foreground" strokeWidth={2} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'achievements' && achievements.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <Trophy className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">
              {language === 'ru' ? 'Первые достижения уже близко' : 'Your first achievements are near'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">
              {language === 'ru' ? 'Выполняйте задания, чтобы открыть награды' : 'Complete challenges to unlock rewards'}
            </p>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="animate-rise-in">
            <div className="inline-flex p-1 rounded-lg bg-secondary gap-1 mb-4">
              {(['all', 'month', 'week'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setLeaderboardPeriod(period)}
                  className={`h-8 px-3 rounded-md text-sm transition-all duration-150 ${
                    leaderboardPeriod === period
                      ? 'bg-card text-foreground shadow-soft font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {period === 'all' ? (language === 'ru' ? 'Все время' : 'All Time') :
                   period === 'month' ? (language === 'ru' ? 'Месяц' : 'Month') :
                   (language === 'ru' ? 'Неделя' : 'Week')}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 border-b border-border last:border-0 transition-colors duration-150 hover:bg-accent/50 animate-rise-in ${
                    index < 3 ? 'bg-accent/50' : ''
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 20}ms` }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold ${
                    entry.rank === 1 ? 'bg-primary text-primary-foreground' :
                    entry.rank === 2 ? 'bg-graphite-200 text-graphite-700' :
                    entry.rank === 3 ? 'bg-emerald-100 text-emerald-800' :
                    'text-graphite-500'
                  }`}>
                    {entry.rank <= 3 ? (
                      <Crown className="w-5 h-5" strokeWidth={1.75} />
                    ) : (
                      entry.rank
                    )}
                  </div>

                  <div className="w-12 h-12 rounded-full bg-emerald-700 text-white ring-1 ring-border flex items-center justify-center font-semibold overflow-hidden">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      entry.username.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-graphite-900 truncate">{entry.username}</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ru' ? 'Уровень' : 'Level'} {entry.level}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-emerald-700">{entry.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">XP</div>
                  </div>
                </div>
              ))}

              {leaderboard.length === 0 && (
                <div className="py-16 px-6 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                    <TrendingUp className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    {language === 'ru' ? 'Пока нет данных' : 'No data yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
