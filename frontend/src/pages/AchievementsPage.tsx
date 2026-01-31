import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Medal, Crown, TrendingUp, MessageSquare, Mic, Heart, Clock } from 'lucide-react';
import { achievementsAPI, Achievement, UserAchievement, UserLevel, LeaderboardEntry } from '../lib/api';

const rarityColors: Record<string, string> = {
  common: 'from-gray-400 to-gray-500',
  uncommon: 'from-green-400 to-green-600',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {userLevel && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-purple-500/20"
          >
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{userLevel.level}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 px-3 py-1 rounded-full text-xs font-semibold">
                  {language === 'ru' ? 'Уровень' : 'Level'}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span className="text-lg font-semibold text-white">
                    {userLevel.current_xp.toLocaleString()} / {userLevel.xp_needed.toLocaleString()} XP
                  </span>
                </div>
                
                <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${userLevel.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </div>
                
                <div className="flex gap-6 mt-4 text-sm text-gray-400">
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
                <div className="text-3xl font-bold text-white">{userLevel.total_xp.toLocaleString()}</div>
                <div className="text-gray-400">{language === 'ru' ? 'Всего XP' : 'Total XP'}</div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'achievements'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            <Trophy className="w-5 h-5 inline-block mr-2" />
            {language === 'ru' ? 'Достижения' : 'Achievements'}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline-block mr-2" />
            {language === 'ru' ? 'Лидерборд' : 'Leaderboard'}
          </button>
          
          <div className="ml-auto">
            <button
              onClick={() => setLanguage(l => l === 'ru' ? 'en' : 'ru')}
              className="px-4 py-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
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
                  className={`relative rounded-xl p-4 border ${
                    isUnlocked
                      ? 'bg-gray-800/70 border-purple-500/50'
                      : 'bg-gray-800/30 border-gray-700/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${rarityColors[ach.rarity]} flex items-center justify-center text-2xl ${!isUnlocked && 'grayscale'}`}>
                      {ach.icon}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {language === 'ru' ? ach.name_ru : ach.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {language === 'ru' ? ach.description_ru : ach.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${rarityColors[ach.rarity]} text-white`}>
                          {ach.rarity}
                        </span>
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
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
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {period === 'all' ? (language === 'ru' ? 'Все время' : 'All Time') :
                   period === 'month' ? (language === 'ru' ? 'Месяц' : 'Month') :
                   (language === 'ru' ? 'Неделя' : 'Week')}
                </button>
              ))}
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-4 p-4 border-b border-gray-700/50 last:border-0 ${
                    index < 3 ? 'bg-gradient-to-r from-purple-900/30 to-transparent' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1 ? 'bg-yellow-500 text-black' :
                    entry.rank === 2 ? 'bg-gray-400 text-black' :
                    entry.rank === 3 ? 'bg-orange-600 text-white' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {entry.rank <= 3 ? (
                      <Crown className="w-5 h-5" />
                    ) : (
                      entry.rank
                    )}
                  </div>
                  
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      entry.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-semibold text-white">{entry.username}</div>
                    <div className="text-sm text-gray-400">
                      {language === 'ru' ? 'Уровень' : 'Level'} {entry.level}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-400">{entry.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">XP</div>
                  </div>
                </motion.div>
              ))}
              
              {leaderboard.length === 0 && (
                <div className="p-8 text-center text-gray-400">
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
