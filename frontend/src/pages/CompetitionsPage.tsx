import { useState, useEffect } from 'react';
import { competitionsAPI, GuildCompetition, GuildCompetitionEntry } from '../lib/api';
import { Trophy, Users, Clock, Medal, Crown, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<GuildCompetition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<GuildCompetition | null>(null);
  const [leaderboard, setLeaderboard] = useState<GuildCompetitionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'ended'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetitions();
  }, [activeTab]);

  const loadCompetitions = async () => {
    setLoading(true);
    try {
      const data = await competitionsAPI.getAll(activeTab);
      setCompetitions(data || []);
    } catch (err) {
      console.error('Failed to load competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitionDetails = async (comp: GuildCompetition) => {
    try {
      const data = await competitionsAPI.get(comp.id);
      setSelectedCompetition(data.competition);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Failed to load competition details:', err);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-accent" />;
      case 2:
        return <Medal className="w-6 h-6 text-muted-foreground" />;
      case 3:
        return <Award className="w-6 h-6 text-accent" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{rank}</span>;
    }
  };

  const tabs = [
    { id: 'active', label: 'Активные' },
    { id: 'upcoming', label: 'Предстоящие' },
    { id: 'ended', label: 'Завершённые' },
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-bold text-foreground">Соревнования гильдий</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-brand text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {competitions.map((comp) => (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => loadCompetitionDetails(comp)}
                className={`bg-card/50 rounded-xl p-5 border cursor-pointer transition-all hover:border-accent/50 ${
                  selectedCompetition?.id === comp.id ? 'border-accent/50' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{comp.name_ru || comp.name}</h3>
                    <p className="text-sm text-muted-foreground">{comp.description_ru || comp.description}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'active' ? 'bg-green-500/20 text-green-400' :
                    activeTab === 'upcoming' ? 'bg-accent/15 text-accent' :
                    'bg-muted/50 text-muted-foreground'
                  }`}>
                    {activeTab === 'active' ? 'Активно' : activeTab === 'upcoming' ? 'Скоро' : 'Завершено'}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {activeTab === 'active' ? (
                      `Осталось ${formatDistanceToNow(new Date(comp.ends_at), { locale: ru })}`
                    ) : activeTab === 'upcoming' ? (
                      `Начало ${format(new Date(comp.starts_at), 'dd MMM', { locale: ru })}`
                    ) : (
                      `Закончено ${format(new Date(comp.ends_at), 'dd MMM', { locale: ru })}`
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {comp.metric === 'messages' ? 'Сообщения' : comp.metric}
                  </div>
                </div>
              </motion.div>
            ))}

            {competitions.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Нет соревнований</p>
              </div>
            )}
          </div>

          {selectedCompetition && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card/50 rounded-xl p-6 border border-border"
            >
              <h3 className="text-xl font-bold text-foreground mb-4">
                Таблица лидеров
              </h3>

              {leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        index < 3 ? 'bg-gradient-to-r from-primary/10 to-transparent' : 'bg-secondary/30'
                      }`}
                    >
                      {getRankIcon(entry.rank)}
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{entry.guild?.name || `Guild #${entry.guild_id}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent">{entry.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">очков</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Пока нет участников</p>
                </div>
              )}

              {selectedCompetition.prizes && (
                <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-primary/10 rounded-lg border border-accent/20">
                  <h4 className="text-sm font-semibold text-accent mb-2">Призы</h4>
                  <div className="text-sm text-foreground">
                    {(() => {
                      try {
                        const prizes = JSON.parse(selectedCompetition.prizes);
                        return (
                          <div className="space-y-1">
                            {prizes['1st'] && <p>🥇 1 место: {prizes['1st'].coins} монет, {prizes['1st'].gems} гемов</p>}
                            {prizes['2nd'] && <p>🥈 2 место: {prizes['2nd'].coins} монет, {prizes['2nd'].gems} гемов</p>}
                            {prizes['3rd'] && <p>🥉 3 место: {prizes['3rd'].coins} монет, {prizes['3rd'].gems} гемов</p>}
                          </div>
                        );
                      } catch {
                        return <p>{selectedCompetition.prizes}</p>;
                      }
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
