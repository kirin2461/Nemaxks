import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Trophy, Gift, Clock, Users, Star, ChevronRight, Check } from 'lucide-react';
import { eventsAPI, GameEvent, EventReward, EventParticipant } from '../lib/api';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';

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
    if (start > now) return { text: 'Скоро', color: 'bg-accent text-accent-foreground' };
    if (end < now) return { text: 'Завершено', color: 'bg-muted text-muted-foreground' };
    return { text: 'Активно', color: 'bg-green-500 text-white' };
  };

  const getThemeColors = (theme: string) => {
    switch (theme) {
      case 'christmas': return 'from-red-600 to-green-600';
      case 'halloween': return 'from-primary to-accent';
      case 'summer': return 'from-accent to-primary';
      case 'winter': return 'from-accent/70 to-primary/60';
      default: return 'from-primary to-accent';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nebula text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold gradient-brand-text">События</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {(['active', 'upcoming', 'ended'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gradient-brand shadow-soft text-white'
                  : 'bg-card/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab === 'active' ? 'Активные' : tab === 'upcoming' ? 'Предстоящие' : 'Завершённые'}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Нет событий</p>
              </div>
            ) : (
              filteredEvents.map(event => {
                const status = getEventStatusBadge(event);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gradient-to-r ${getThemeColors(event.theme)} p-px rounded-xl cursor-pointer shadow-soft hover:shadow-glow transition-shadow`}
                    onClick={() => setSelectedEvent(event.id)}
                  >
                    <div className="bg-card/90 backdrop-blur-xl rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">{event.event_type}</span>
                          </div>
                          <h3 className="text-xl font-bold">{event.name}</h3>
                          <p className="text-muted-foreground text-sm mt-1">{event.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(new Date(event.start_date), 'MMM d')} -{' '}
                            {format(new Date(event.end_date), 'MMM d')}
                          </span>
                        </div>
                        {event.coin_bonus > 1 && (
                          <div className="flex items-center gap-1 text-accent">
                            <Star className="w-4 h-4" />
                            <span>{event.coin_bonus}x монеты</span>
                          </div>
                        )}
                        {event.xp_bonus > 1 && (
                          <div className="flex items-center gap-1 text-primary">
                            <Star className="w-4 h-4" />
                            <span>{event.xp_bonus}x XP</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="space-y-6">
            {selectedEvent && eventDetails ? (
              <>
                <div className="glass rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-primary" />
                    Награды
                  </h3>
                  <div className="space-y-3">
                    {eventDetails.rewards.map(reward => (
                      <div
                        key={reward.id}
                        className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{reward.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {reward.threshold} {reward.requirement}
                          </p>
                        </div>
                        <button
                          onClick={() => claimRewardMutation.mutate({ eventId: selectedEvent, rewardId: reward.id })}
                          disabled={claimRewardMutation.isPending}
                          className="px-3 py-1 bg-gradient-brand shadow-soft rounded-lg text-sm hover:brightness-110 disabled:opacity-50"
                        >
                          Забрать
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" />
                    Лидерборд
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.map((participant, idx) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-gradient-brand' : idx === 1 ? 'bg-muted-foreground/50' : idx === 2 ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1">{participant.user?.username || 'Пользователь'}</span>
                        <span className="text-primary font-medium">{participant.points} очков</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => joinMutation.mutate(selectedEvent)}
                  disabled={joinMutation.isPending}
                  className="w-full py-3 bg-gradient-brand text-white rounded-xl font-bold shadow-soft hover:brightness-110 hover:shadow-glow transition-all disabled:opacity-50"
                >
                  {joinMutation.isPending ? 'Вступление...' : 'Участвовать'}
                </button>
              </>
            ) : (
              <div className="glass rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Выберите событие, чтобы увидеть детали</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
