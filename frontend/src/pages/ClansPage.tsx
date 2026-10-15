import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Crown, Target, Lock, Globe, ChevronRight, X } from 'lucide-react';
import { clansAPI, Clan, ClanChallenge } from '../lib/api';

export default function ClansPage() {
  const queryClient = useQueryClient();
  const [selectedGuildId, setSelectedGuildId] = useState<number>(1);
  const [selectedClan, setSelectedClan] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanDesc, setNewClanDesc] = useState('');
  const [newClanColor, setNewClanColor] = useState('#047857');
  const [newClanPublic, setNewClanPublic] = useState(true);

  const { data: clans = [], isLoading } = useQuery({
    queryKey: ['clans', selectedGuildId],
    queryFn: () => clansAPI.getGuildClans(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['clan-challenges', selectedClan],
    queryFn: () => clansAPI.getChallenges(selectedClan!),
    enabled: !!selectedClan,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      clansAPI.create({
        guild_id: selectedGuildId,
        name: newClanName,
        description: newClanDesc,
        color: newClanColor,
        is_public: newClanPublic,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
      setShowCreateModal(false);
      setNewClanName('');
      setNewClanDesc('');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (clanId: number) => clansAPI.join(clanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-40 rounded-lg" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton h-32 rounded-xl" />
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
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            <div>
              <h1 className="text-2xl font-display font-bold text-graphite-900">Кланы</h1>
              <p className="text-sm text-muted-foreground">Объединяйтесь и выполняйте испытания</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Создать клан
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {clans.map((clan: Clan, index: number) => (
              <div
                key={clan.id}
                className={`rounded-xl border bg-card shadow-soft cursor-pointer overflow-hidden transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 ${
                  selectedClan === clan.id ? 'border-primary' : 'border-border'
                }`}
                onClick={() => setSelectedClan(clan.id)}
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <div className="h-16 bg-graphite-100" style={{ backgroundColor: `${clan.color}14` }} />
                <div className="p-6 pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className="w-12 h-12 -mt-6 shrink-0 rounded-lg border border-border bg-card flex items-center justify-center text-xl font-display font-bold shadow-soft"
                        style={{ color: clan.color }}
                      >
                        {clan.name[0]}
                      </div>
                      <div className="min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-graphite-900 truncate">{clan.name}</h3>
                          {clan.is_public ? (
                            <Globe className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.75} />
                          ) : (
                            <Lock className="w-4 h-4 text-graphite-500 shrink-0" strokeWidth={1.75} />
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">{clan.description || 'Нет описания'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Crown className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                            {clan.leader?.username || 'Неизвестно'}
                          </div>
                          <span className="font-mono text-xs">{clan.total_xp.toLocaleString()} XP</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" strokeWidth={1.75} />
                  </div>

                  {clan.is_public && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        joinMutation.mutate(clan.id);
                      }}
                      disabled={joinMutation.isPending}
                      className="mt-4 w-full h-9 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                    >
                      Вступить в клан
                    </button>
                  )}
                </div>
              </div>
            ))}

            {clans.length === 0 && (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Users className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4 text-graphite-900">Создайте свой клан</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto mb-4">Создайте первый клан!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97]"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Создать клан
                </button>
              </div>
            )}
          </div>

          <div>
            {selectedClan ? (
              <div className="rounded-xl border border-border bg-card shadow-soft p-6 sticky top-6 animate-rise-in" key={selectedClan}>
                <h3 className="text-lg font-semibold text-graphite-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                  Испытания клана
                </h3>
                <div className="space-y-3">
                  {challenges.map((challenge: ClanChallenge) => (
                    <div
                      key={challenge.id}
                      className={`rounded-lg border p-4 ${
                        challenge.is_completed ? 'bg-accent/30 border-emerald-200' : 'bg-secondary border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-graphite-900">{challenge.name}</span>
                        {challenge.is_completed && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Завершено</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">{challenge.description}</p>
                      <div className="w-full bg-graphite-200 rounded-full h-2 mb-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full animate-bar-grow origin-left"
                          style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-mono">
                          {challenge.progress}/{challenge.goal}
                        </span>
                        <span>+{challenge.reward_coins} монет, +{challenge.reward_xp} XP</span>
                      </div>
                    </div>
                  ))}
                  {challenges.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">Нет активных испытаний</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center sticky top-6">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Target className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground mt-4 max-w-[320px] mx-auto">Выберите клан, чтобы увидеть испытания</p>
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center animate-fade-in-soft">
            <div className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-6 shadow-pop animate-scale-in m-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-graphite-900">Создать клан</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Название клана</label>
                  <input
                    type="text"
                    value={newClanName}
                    onChange={e => setNewClanName(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Описание</label>
                  <textarea
                    value={newClanDesc}
                    onChange={e => setNewClanDesc(e.target.value)}
                    className="input-field w-full resize-none h-auto py-2"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Цвет</label>
                  <input
                    type="color"
                    value={newClanColor}
                    onChange={e => setNewClanColor(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card cursor-pointer"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newClanPublic}
                    onChange={e => setNewClanPublic(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span className="text-sm">Публичный клан (любой может вступить)</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="h-10 px-4 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 active:scale-[0.97]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newClanName || createMutation.isPending}
                    className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Создать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
