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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="w-8 h-8 text-orange-400" />
          <h1 className="text-3xl font-bold">Trending & For You</h1>
        </div>

        {recommendations.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Recommended For You
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {recommendations.map((rec: Recommendation) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-5 border border-purple-500/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded capitalize">
                        {rec.content_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round((rec.score || 0) * 100)}% match
                      </span>
                    </div>
                    <button
                      onClick={() => dismissMutation.mutate(rec.id)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{rec.reason}</p>
                  <p className="text-xs text-gray-500">
                    Content ID: {rec.content_id}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          Trending Now
        </h2>

        <div className="space-y-4">
          {trending.map((content: TrendingContent, index: number) => (
            <motion.div
              key={content.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400 font-bold">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded capitalize">
                      {content.content_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: {Math.round(content.score || 0)}
                    </span>
                  </div>
                  <p className="text-gray-300 mb-3">
                    {content.content_type === 'post' && `Post #${content.content_id}`}
                    {content.content_type === 'channel' && `Channel #${content.content_id}`}
                    {content.content_type === 'video' && `Video #${content.content_id}`}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
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
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Nothing trending yet</h3>
            <p className="text-gray-400">
              Content with high engagement will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
