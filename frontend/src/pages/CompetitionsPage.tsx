import { useState, useEffect } from 'react';
import { competitionsAPI, GuildCompetition, GuildCompetitionEntry } from '../lib/api';
import { Trophy, Users, Clock, Medal, Crown, Award } from 'lucide-react';
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
        return <Crown className="w-6 h-6 text-emerald-700" strokeWidth={1.75} />;
      case 2:
        return <Medal className="w-6 h-6 text-graphite-500" strokeWidth={1.75} />;
      case 3:
        return <Award className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />;
      default:
        return <span className="w-10 font-display font-bold text-graphite-500 text-center">{rank}</span>;
    }
  };

  const tabs = [
    { id: 'active', label: 'Активные' },
    { id: 'upcoming', label: 'Предстоящие' },
    { id: 'ended', label: 'Завершённые' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-72 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
            </div>
            <div className="skeleton h-72 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-6xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Соревнования гильдий</h1>
            <p className="text-sm text-muted-foreground">Сражайтесь за призовые места</p>
          </div>
        </div>

        <div className="flex gap-6 border-b border-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" key={activeTab}>
          <div className="space-y-4">
            {competitions.map((comp, index) => (
              <div
                key={comp.id}
                onClick={() => loadCompetitionDetails(comp)}
                className={`rounded-xl bg-card border shadow-soft p-5 cursor-pointer transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 ${
                  selectedCompetition?.id === comp.id ? 'border-primary' : 'border-border'
                }`}
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-graphite-900">{comp.name_ru || comp.name}</h3>
                    <p className="text-sm text-muted-foreground">{comp.description_ru || comp.description}</p>
                  </div>
                  <div className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    activeTab === 'active' ? 'bg-success-soft text-emerald-800' :
                    activeTab === 'upcoming' ? 'bg-warning-soft text-[hsl(32_95%_30%)]' :
                    'bg-secondary text-secondary-foreground'
                  }`}>
                    {activeTab === 'active' ? 'Активно' : activeTab === 'upcoming' ? 'Скоро' : 'Завершено'}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <Clock className="w-4 h-4" strokeWidth={1.75} />
                    {activeTab === 'active' ? (
                      `Осталось ${formatDistanceToNow(new Date(comp.ends_at), { locale: ru })}`
                    ) : activeTab === 'upcoming' ? (
                      `Начало ${format(new Date(comp.starts_at), 'dd MMM', { locale: ru })}`
                    ) : (
                      `Закончено ${format(new Date(comp.ends_at), 'dd MMM', { locale: ru })}`
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" strokeWidth={1.75} />
                    {comp.metric === 'messages' ? 'Сообщения' : comp.metric}
                  </div>
                </div>
              </div>
            ))}

            {competitions.length === 0 && (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Trophy className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4 text-graphite-900">Соревнования ещё не начались</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Загляните позже</p>
              </div>
            )}
          </div>

          {selectedCompetition && (
            <div className="rounded-xl border border-border bg-card shadow-soft p-6 animate-slide-in-right h-fit">
              <h3 className="text-lg font-semibold text-graphite-900 mb-4">
                Таблица лидеров
              </h3>

              {leaderboard.length > 0 ? (
                <div>
                  <div className="flex items-center gap-4 pb-2 text-xs uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                    <span className="w-10">#</span>
                    <span className="flex-1">Гильдия</span>
                    <span>Очки</span>
                  </div>
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 h-14 border-b border-border last:border-0 transition-colors duration-150 hover:bg-accent/50 animate-rise-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 20}ms` }}
                    >
                      <div className="w-10 flex justify-center shrink-0">{getRankIcon(entry.rank)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-graphite-900 truncate">{entry.guild?.name || `Guild #${entry.guild_id}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-emerald-700">{entry.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">очков</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-graphite-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">Пока нет участников</p>
                </div>
              )}

              {selectedCompetition.prizes && (
                <div className="mt-6 p-4 rounded-lg bg-accent/50 border border-emerald-200">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-2">Призы</h4>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
