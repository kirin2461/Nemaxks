import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
      case 'gift_received': return { icon: Gift, color: 'text-pink-400', bg: 'bg-pink-400/10' };
      case 'trade_request':
      case 'trade_accepted':
      case 'trade_rejected': return { icon: ArrowLeftRight, color: 'text-blue-400', bg: 'bg-blue-400/10' };
      case 'friend_add': return { icon: UserPlus, color: 'text-green-400', bg: 'bg-green-400/10' };
      case 'level_up': return { icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' };
      case 'achievement': return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 'mentorship_request': return { icon: Star, color: 'text-orange-400', bg: 'bg-orange-400/10' };
      case 'message': return { icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
      case 'like':
      case 'reaction': return { icon: Heart, color: 'text-red-400', bg: 'bg-red-400/10' };
      default: return { icon: Bell, color: 'text-muted-foreground', bg: 'bg-gray-400/10' };
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-brand text-white shadow-glow">
              <Bell className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="gradient-brand-text">Activity</span>
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-1 bg-gradient-brand text-white rounded-full text-sm font-medium shadow-glow">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:shadow-glow text-sm transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        <div className="space-y-3">
          {activities.map((activity, idx) => {
            const { icon: Icon, color, bg } = getActivityIcon(activity.action_type);
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-xl flex items-start gap-4 cursor-pointer transition-all hover:shadow-lg-brand ${
                  activity.is_read ? 'glass' : 'glass border-l-4 border-primary'
                }`}
                onClick={() => !activity.is_read && markReadMutation.mutate(activity.id)}
              >
                <div className={`p-2 rounded-lg ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${activity.is_read ? 'text-foreground' : 'text-foreground font-medium'}`}>
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!activity.is_read && (
                  <div className="w-2 h-2 bg-gradient-brand rounded-full mt-2 shadow-glow" />
                )}
              </motion.div>
            );
          })}

          {activities.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No activity yet</h3>
              <p className="text-muted-foreground">Your activity feed will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
