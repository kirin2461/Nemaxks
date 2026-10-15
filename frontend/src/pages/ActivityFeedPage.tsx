import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Gift, ArrowLeftRight, UserPlus, Trophy, Star, MessageSquare, Heart, TrendingUp } from 'lucide-react';
import { activityFeedAPI, ActivityFeedItem } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityFeedPage() {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => activityFeedAPI.get(100),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => activityFeedAPI.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => activityFeedAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'gift_received': return { icon: Gift, color: 'text-emerald-600' };
      case 'trade_request':
      case 'trade_accepted':
      case 'trade_rejected': return { icon: ArrowLeftRight, color: 'text-graphite-500' };
      case 'friend_add': return { icon: UserPlus, color: 'text-emerald-600' };
      case 'level_up': return { icon: TrendingUp, color: 'text-emerald-600' };
      case 'achievement': return { icon: Trophy, color: 'text-warning' };
      case 'mentorship_request': return { icon: Star, color: 'text-graphite-500' };
      case 'message': return { icon: MessageSquare, color: 'text-emerald-600' };
      case 'like':
      case 'reaction': return { icon: Heart, color: 'text-emerald-600' };
      default: return { icon: Bell, color: 'text-graphite-500' };
    }
  };

  const getActivityMessage = (activity: ActivityFeedItem) => {
    const actor = activity.actor?.username || 'Someone';
    switch (activity.action_type) {
      case 'gift_received': return `${actor} sent you a gift`;
      case 'trade_request': return `${actor} wants to trade with you`;
      case 'trade_accepted': return `${actor} accepted your trade`;
      case 'trade_rejected': return `${actor} declined your trade`;
      case 'friend_add': return `${actor} added you as a friend`;
      case 'level_up': return `You reached a new level!`;
      case 'achievement': return `You unlocked a new achievement!`;
      case 'mentorship_request': return `${actor} wants you as their mentor`;
      case 'message': return `${actor} sent you a message`;
      case 'like': return `${actor} liked your post`;
      case 'reaction': return `${actor} reacted to your message`;
      default: return `${actor} did something`;
    }
  };

  const unreadCount = activities.filter(a => !a.is_read).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-6 py-6">
        <div className="max-w-[560px] mx-auto space-y-3">
          <div className="skeleton h-9 w-44 mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card shadow-soft p-4 flex gap-4">
              <div className="skeleton h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-6 animate-rise-in">
      <div className="max-w-[560px] mx-auto">
        <div className="flex items-center justify-between pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Bell className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-graphite-900">
              Activity
            </h1>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        <div className="space-y-2">
          {activities.map((activity, idx) => {
            const { icon: Icon, color } = getActivityIcon(activity.action_type);
            return (
              <div
                key={activity.id}
                className={`p-4 rounded-xl border border-border flex items-start gap-3 cursor-pointer transition-all duration-150 hover:shadow-elev animate-rise-in ${
                  activity.is_read ? 'bg-card shadow-soft' : 'bg-accent/40 shadow-soft'
                }`}
                style={{ animationDelay: `${Math.min(idx, 8) * 25}ms` }}
                onClick={() => !activity.is_read && markReadMutation.mutate(activity.id)}
              >
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
                  <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${activity.is_read ? 'text-foreground' : 'text-foreground font-medium'}`}>
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-graphite-400 mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!activity.is_read && (
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 shrink-0" />
                )}
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
              <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                <Bell className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold mt-4 mb-1">No activity yet</h3>
              <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Your activity feed will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
