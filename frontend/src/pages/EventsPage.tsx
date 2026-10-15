import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Trophy, Gift, Clock, Star, ChevronRight } from 'lucide-react';
import { eventsAPI, GameEvent, EventReward, EventParticipant } from '../lib/api';
import { format } from 'date-fns';

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'ended'>('active');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsAPI.getAll(),
  });

  const { data: eventDetails } = useQuery({
    queryKey: ['event', selectedEvent],
    queryFn: () => eventsAPI.get(selectedEvent!),
    enabled: !!selectedEvent,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['event-leaderboard', selectedEvent],
    queryFn: () => eventsAPI.getLeaderboard(selectedEvent!, 10),
    enabled: !!selectedEvent,
  });

  const joinMutation = useMutation({
    mutationFn: (eventId: number) => eventsAPI.join(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-leaderboard', selectedEvent] });
    },
  });

  const claimRewardMutation = useMutation({
    mutationFn: ({ eventId, rewardId }: { eventId: number; rewardId: number }) =>
      eventsAPI.claimReward(eventId, rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', selectedEvent] });
    },
  });

  const now = new Date();
  const filteredEvents = events.filter(event => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    if (activeTab === 'active') return start <= now && end >= now;
    if (activeTab === 'upcoming') return start > now;
    return end < now;
  });

  const getEventStatusBadge = (event: GameEvent) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    if (start > now) return { text: 'Скоро', color: 'bg-warning-soft text-[hsl(32_95%_30%)]', live: false };
    if (end < now) return { text: 'Завершено', color: 'bg-secondary text-secondary-foreground', live: false };
    return { text: 'Активно', color: 'bg-emerald-100 text-emerald-800', live: true };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-40 rounded-lg" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
            <div className="skeleton h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-7xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">События</h1>
            <p className="text-sm text-muted-foreground">Ивенты, награды и лидерборды</p>
          </div>
        </div>

        <div className="flex gap-6 border-b border-border mb-6">
          {(['active', 'upcoming', 'ended'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === tab
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab === 'active' ? 'Активные' : tab === 'upcoming' ? 'Предстоящие' : 'Завершённые'}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6" key={activeTab}>
          <div className="lg:col-span-2 space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Calendar className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4 text-graphite-900">Ближайших событий нет</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Загляните позже</p>
              </div>
            ) : (
              filteredEvents.map((event, index) => {
                const status = getEventStatusBadge(event);
                const start = new Date(event.start_date);
                const isEnded = new Date(event.end_date) < now;
                return (
                  <div
                    key={event.id}
                    className={`rounded-xl border bg-card shadow-soft cursor-pointer transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 ${
                      selectedEvent === event.id ? 'border-primary' : 'border-border'
                    } ${isEnded ? 'opacity-60' : ''}`}
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                    onClick={() => setSelectedEvent(event.id)}
                  >
                    <div className="p-6 flex items-start gap-4">
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-2xl font-display font-bold text-graphite-900 leading-none">
                          {format(start, 'd')}
                        </div>
                        <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground mt-1">
                          {format(start, 'MMM')}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                              {status.live && (
                                <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/40 animate-pulse-ring" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                                </span>
                              )}
                              {status.text}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">{event.event_type}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-xl font-display font-bold text-graphite-900">{event.name}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{event.description}</p>

                        <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <Clock className="w-4 h-4" strokeWidth={1.75} />
                            <span>
                              {format(start, 'MMM d')} -{' '}
                              {format(new Date(event.end_date), 'MMM d')}
                            </span>
                          </div>
                          {event.coin_bonus > 1 && (
                            <div className="flex items-center gap-1 text-graphite-600">
                              <Star className="w-4 h-4" strokeWidth={1.75} />
                              <span>{event.coin_bonus}x монеты</span>
                            </div>
                          )}
                          {event.xp_bonus > 1 && (
                            <div className="flex items-center gap-1 text-emerald-700">
                              <Star className="w-4 h-4" strokeWidth={1.75} />
                              <span>{event.xp_bonus}x XP</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-6">
            {selectedEvent && eventDetails ? (
              <>
                <div className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in" key={`rewards-${selectedEvent}`}>
                  <h3 className="text-lg font-semibold text-graphite-900 mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                    Награды
                  </h3>
                  <div className="space-y-3">
                    {eventDetails.rewards.map(reward => (
                      <div
                        key={reward.id}
                        className="bg-secondary rounded-lg p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-graphite-900">{reward.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {reward.threshold} {reward.requirement}
                          </p>
                        </div>
                        <button
                          onClick={() => claimRewardMutation.mutate({ eventId: selectedEvent, rewardId: reward.id })}
                          disabled={claimRewardMutation.isPending}
                          className="shrink-0 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                        >
                          Забрать
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in" key={`board-${selectedEvent}`} style={{ animationDelay: '60ms' }}>
                  <h3 className="text-lg font-semibold text-graphite-900 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                    Лидерборд
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.map((participant, idx) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-secondary animate-rise-in"
                        style={{ animationDelay: `${Math.min(idx, 8) * 20}ms` }}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold ${
                            idx === 0 ? 'bg-primary text-primary-foreground' :
                            idx === 1 ? 'bg-graphite-200 text-graphite-700' :
                            idx === 2 ? 'bg-emerald-100 text-emerald-800' :
                            'bg-card text-graphite-500 border border-border'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-sm text-graphite-900 truncate">{participant.user?.username || 'Пользователь'}</span>
                        <span className="text-emerald-700 font-mono text-sm font-medium">{participant.points} очков</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => joinMutation.mutate(selectedEvent)}
                  disabled={joinMutation.isPending}
                  className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {joinMutation.isPending ? 'Вступление...' : 'Участвовать'}
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Calendar className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground mt-4 max-w-[320px] mx-auto">Выберите событие, чтобы увидеть детали</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
