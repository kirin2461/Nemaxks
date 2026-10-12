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
    if (start > now) return { text: 'Upcoming', color: 'bg-blue-500' };
    if (end < now) return { text: 'Ended', color: 'bg-gray-500' };
    return { text: 'Active', color: 'bg-green-500' };
  };

  const getThemeColors = (theme: string) => {
    switch (theme) {
      case 'christmas': return 'from-red-600 to-green-600';
      case 'halloween': return 'from-orange-500 to-purple-700';
      case 'summer': return 'from-yellow-400 to-orange-500';
      case 'winter': return 'from-blue-400 to-cyan-300';
      default: return 'from-purple-600 to-indigo-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Events</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {(['active', 'upcoming', 'ended'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No {activeTab} events</p>
              </div>
            ) : (
              filteredEvents.map(event => {
                const status = getEventStatusBadge(event);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gradient-to-r ${getThemeColors(event.theme)} p-1 rounded-xl cursor-pointer`}
                    onClick={() => setSelectedEvent(event.id)}
                  >
                    <div className="bg-card rounded-xl p-6">
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
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-4 h-4" />
                            <span>{event.coin_bonus}x Coins</span>
                          </div>
                        )}
                        {event.xp_bonus > 1 && (
                          <div className="flex items-center gap-1 text-purple-400">
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
                <div className="bg-card rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-400" />
                    Rewards
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
                          className="px-3 py-1 bg-purple-600 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                        >
                          Claim
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    Leaderboard
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.map((participant, idx) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-muted'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1">{participant.user?.username || 'User'}</span>
                        <span className="text-purple-400 font-medium">{participant.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => joinMutation.mutate(selectedEvent)}
                  disabled={joinMutation.isPending}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {joinMutation.isPending ? 'Joining...' : 'Join Event'}
                </button>
              </>
            ) : (
              <div className="bg-card rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select an event to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
