import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Sparkles, Eye, Heart, MessageSquare, X } from 'lucide-react';
import { trendingAPI, TrendingContent, UserRecommendation } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

type Recommendation = UserRecommendation;

export default function TrendingPage() {
  const queryClient = useQueryClient();

  const { data: trending = [], isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: () => trendingAPI.get(),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => trendingAPI.getRecommendations(),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => trendingAPI.dismissRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  if (trendingLoading) {
    return (
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nebula text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-gradient-brand text-white shadow-glow">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-brand-text">В тренде</span> и для вас
          </h1>
        </div>

        {recommendations.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 tracking-tight">
              <Sparkles className="w-5 h-5 text-primary" />
              Рекомендовано вам
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {recommendations.map((rec: Recommendation) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass rounded-xl p-5 border border-primary/30 hover:shadow-glow transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-primary/30 text-primary/80 px-2 py-0.5 rounded capitalize">
                        {rec.content_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((rec.score || 0) * 100)}% совпадение
                      </span>
                    </div>
                    <button
                      onClick={() => dismissMutation.mutate(rec.id)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground mb-2">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    ID контента: {rec.content_id}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 tracking-tight">
          <TrendingUp className="w-5 h-5 text-accent" />
          Сейчас в тренде
        </h2>

        <div className="space-y-4">
          {trending.map((content: TrendingContent, index: number) => (
            <motion.div
              key={content.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-secondary text-foreground px-2 py-0.5 rounded capitalize">
                      {content.content_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Очки: {Math.round(content.score || 0)}
                    </span>
                  </div>
                  <p className="text-foreground mb-3">
                    {content.content_type === 'post' && `Пост #${content.content_id}`}
                    {content.content_type === 'channel' && `Канал #${content.content_id}`}
                    {content.content_type === 'video' && `Видео #${content.content_id}`}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {(content.views || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {(content.likes || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {(content.comments || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {trending.length === 0 && (
          <div className="glass rounded-xl p-12 text-center">
            <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Пока ничего нет в трендах</h3>
            <p className="text-muted-foreground">
              Здесь появится контент с высокой активностью
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
