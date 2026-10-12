import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Medal, Crown, TrendingUp, MessageSquare, Mic, Heart, Clock } from 'lucide-react';
import { achievementsAPI, Achievement, UserAchievement, UserLevel, LeaderboardEntry } from '../lib/api';

const rarityColors: Record<string, string> = {
  common: 'from-muted-foreground/40 to-muted-foreground/60',
  uncommon: 'from-accent/50 to-accent/80',
  rare: 'from-accent to-primary',
  epic: 'from-primary to-accent',
  legendary: 'from-primary via-accent to-primary',
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
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nebula p-6">
      <div className="max-w-6xl mx-auto">
        {userLevel && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-brand glow flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{userLevel.level}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-brand text-white px-3 py-1 rounded-full text-xs font-semibold shadow-soft">
                  {language === 'ru' ? 'Уровень' : 'Level'}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-accent" />
                  <span className="text-lg font-semibold text-foreground">
                    {userLevel.current_xp.toLocaleString()} / {userLevel.xp_needed.toLocaleString()} XP
                  </span>
                </div>
                
                <div className="w-full h-4 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${userLevel.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                
                <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{userLevel.messages} {language === 'ru' ? 'сообщений' : 'messages'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span>{userLevel.voice_mins} {language === 'ru' ? 'мин в голосе' : 'voice mins'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    <span>{userLevel.reactions} {language === 'ru' ? 'реакций' : 'reactions'}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground">{userLevel.total_xp.toLocaleString()}</div>
                <div className="text-muted-foreground">{language === 'ru' ? 'Всего XP' : 'Total XP'}</div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'achievements'
                ? 'bg-gradient-brand shadow-soft text-white'
                : 'bg-card/50 text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Trophy className="w-5 h-5 inline-block mr-2" />
            {language === 'ru' ? 'Достижения' : 'Achievements'}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-brand shadow-soft text-white'
                : 'bg-card/50 text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline-block mr-2" />
            {language === 'ru' ? 'Лидерборд' : 'Leaderboard'}
          </button>
          
          <div className="ml-auto">
            <button
              onClick={() => setLanguage(l => l === 'ru' ? 'en' : 'ru')}
              className="px-4 py-2 rounded-lg bg-card/50 text-muted-foreground hover:bg-secondary/50"
            >
              {language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
            </button>
          </div>
        </div>

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((ach, index) => {
              const isUnlocked = unlockedIds.has(ach.id);
              const Icon = categoryIcons[ach.category] || Trophy;
              
              return (
                <motion.div
                  key={ach.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative rounded-xl p-4 border backdrop-blur-xl transition-all ${
                    isUnlocked
                      ? 'bg-card/55 border-primary/40 shadow-soft hover:shadow-glow'
                      : 'bg-card/30 border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${rarityColors[ach.rarity]} flex items-center justify-center text-2xl ${!isUnlocked && 'grayscale'}`}>
                      {ach.icon}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {language === 'ru' ? ach.name_ru : ach.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {language === 'ru' ? ach.description_ru : ach.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${rarityColors[ach.rarity]} text-white`}>
                          {ach.rarity}
                        </span>
                        <span className="text-xs text-accent flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          +{ach.xp_reward} XP
                        </span>
                      </div>
                    </div>
                    
                    {isUnlocked && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div>
            <div className="flex gap-2 mb-4">
              {(['all', 'month', 'week'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setLeaderboardPeriod(period)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    leaderboardPeriod === period
                      ? 'bg-gradient-brand shadow-soft text-white'
                      : 'bg-card/50 text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {period === 'all' ? (language === 'ru' ? 'Все время' : 'All Time') :
                   period === 'month' ? (language === 'ru' ? 'Месяц' : 'Month') :
                   (language === 'ru' ? 'Неделя' : 'Week')}
                </button>
              ))}
            </div>
            
            <div className="glass rounded-xl overflow-hidden">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-4 p-4 border-b border-border/50 last:border-0 ${
                    index < 3 ? 'bg-gradient-to-r from-primary/25 to-transparent' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1 ? 'bg-gradient-brand text-white' :
                    entry.rank === 2 ? 'bg-muted-foreground/50 text-white' :
                    entry.rank === 3 ? 'bg-accent text-white' :
                    'bg-secondary text-foreground'
                  }`}>
                    {entry.rank <= 3 ? (
                      <Crown className="w-5 h-5" />
                    ) : (
                      entry.rank
                    )}
                  </div>
                  
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      entry.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{entry.username}</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ru' ? 'Уровень' : 'Level'} {entry.level}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{entry.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">XP</div>
                  </div>
                </motion.div>
              ))}
              
              {leaderboard.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {language === 'ru' ? 'Пока нет данных' : 'No data yet'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
