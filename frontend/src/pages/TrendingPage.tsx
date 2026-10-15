import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Sparkles, Eye, Heart, MessageSquare, X } from 'lucide-react';
import { trendingAPI, TrendingContent, UserRecommendation } from '../lib/api';

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
      <div className="min-h-screen bg-background px-6 py-6">
        <div className="max-w-[1440px] mx-auto space-y-4">
          <div className="skeleton h-9 w-56" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card shadow-soft p-5 flex gap-4">
              <div className="skeleton h-9 w-12" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
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
      <div className="max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 pt-0 pb-4 mb-4">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-soft">
            <TrendingUp className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-graphite-900">
            В тренде и для вас
          </h1>
        </div>

        {recommendations.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2 tracking-tight">
              <Sparkles className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
              Рекомендовано вам
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {recommendations.map((rec: Recommendation, index: number) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-border bg-card shadow-soft p-5 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 animate-rise-in"
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                        {rec.content_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((rec.score || 0) * 100)}% совпадение
                      </span>
                    </div>
                    <button
                      onClick={() => dismissMutation.mutate(rec.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground mb-2">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    ID контента: {rec.content_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2 tracking-tight">
          <TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
          Сейчас в тренде
        </h2>

        <div className="space-y-3">
          {trending.map((content: TrendingContent, index: number) => (
            <div
              key={content.id}
              className="rounded-xl border border-border bg-card shadow-soft p-5 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 animate-rise-in"
              style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 shrink-0 text-3xl font-display font-bold animate-count-flick ${
                    index < 3 ? 'text-emerald-700' : 'text-graphite-300'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                      {content.content_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Очки: {Math.round(content.score || 0)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    {content.content_type === 'post' && `Пост #${content.content_id}`}
                    {content.content_type === 'channel' && `Канал #${content.content_id}`}
                    {content.content_type === 'video' && `Видео #${content.content_id}`}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                      {(content.views || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4" strokeWidth={1.75} />
                      {(content.likes || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
                      {(content.comments || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {trending.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <TrendingUp className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 mb-1">Пока ничего нет в трендах</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">
              Здесь появится контент с высокой активностью
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
