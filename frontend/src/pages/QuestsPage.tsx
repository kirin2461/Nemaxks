import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Scroll, ChevronRight, CheckCircle, Circle, Coins, Star, Gift, Lock, Play } from 'lucide-react';
import { questsAPI, QuestChain, QuestStep, UserQuestProgress } from '../lib/api';

export default function QuestsPage() {
  const queryClient = useQueryClient();
  const [selectedChain, setSelectedChain] = useState<number | null>(null);

  const { data: chains = [], isLoading } = useQuery({
    queryKey: ['quests'],
    queryFn: () => questsAPI.getAll(),
  });

  const { data: myQuests = [] } = useQuery({
    queryKey: ['my-quests'],
    queryFn: () => questsAPI.getMy(),
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['quest-steps', selectedChain],
    queryFn: () => questsAPI.getSteps(selectedChain!),
    enabled: !!selectedChain,
  });

  const startMutation = useMutation({
    mutationFn: (chainId: number) => questsAPI.start(chainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-quests'] });
    },
  });

  const getProgress = (chainId: number): UserQuestProgress | undefined => {
    return myQuests.find(q => q.chain_id === chainId);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tutorial': return 'from-accent/70 to-primary';
      case 'social': return 'from-accent to-accent/70';
      case 'content': return 'from-primary to-accent';
      case 'exploration': return 'from-primary to-accent';
      default: return 'from-muted-foreground/40 to-muted-foreground/60';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tutorial': return '📚';
      case 'social': return '👥';
      case 'content': return '✨';
      case 'exploration': return '🧭';
      default: return '📋';
    }
  };

  const parseFinalReward = (rewardStr: string) => {
    try {
      return JSON.parse(rewardStr);
    } catch {
      return {};
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Scroll className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold gradient-brand-text">Цепочки квестов</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {chains.map(chain => {
              const progress = getProgress(chain.id);
              const isStarted = !!progress;
              const isCompleted = progress?.is_completed;
              const finalReward = parseFinalReward(chain.final_reward);

              return (
                <motion.div
                  key={chain.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-gradient-to-r ${getCategoryColor(chain.category)} p-px rounded-xl cursor-pointer shadow-soft hover:shadow-glow transition-shadow`}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <div className="bg-card/90 backdrop-blur-xl rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="text-3xl">{getCategoryIcon(chain.category)}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold">{chain.name}</h3>
                            {isCompleted && (
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm mb-3">{chain.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {progress?.current_step || 0}/{chain.total_steps} шагов
                            </span>
                            {finalReward.coins && (
                              <div className="flex items-center gap-1 text-accent">
                                <Coins className="w-4 h-4" />
                                <span>{finalReward.coins}</span>
                              </div>
                            )}
                            {finalReward.gems && (
                              <div className="flex items-center gap-1 text-primary">
                                <Gift className="w-4 h-4" />
                                <span>{finalReward.gems}</span>
                              </div>
                            )}
                            {finalReward.xp && (
                              <div className="flex items-center gap-1 text-accent">
                                <Star className="w-4 h-4" />
                                <span>{finalReward.xp} XP</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    {isStarted && !isCompleted && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Прогресс</span>
                          <span className="text-primary">
                            {Math.round(((progress?.current_step || 1) / chain.total_steps) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-gradient-brand shadow-soft h-2 rounded-full transition-all"
                            style={{
                              width: `${((progress?.current_step || 1) / chain.total_steps) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {chains.length === 0 && (
              <div className="glass rounded-xl p-8 text-center">
                <Scroll className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Квесты пока недоступны</p>
              </div>
            )}
          </div>

          <div>
            {selectedChain ? (
              <div className="glass rounded-xl p-6 sticky top-6">
                <h3 className="text-lg font-bold mb-4">Шаги квеста</h3>
                
                {(() => {
                  const chain = chains.find(c => c.id === selectedChain);
                  const progress = getProgress(selectedChain);
                  const currentStep = progress?.current_step || 0;

                  return (
                    <>
                      <div className="space-y-3 mb-6">
                        {steps.map((step, idx) => {
                          const isCompleted = idx + 1 < currentStep;
                          const isCurrent = idx + 1 === currentStep;
                          const isLocked = idx + 1 > currentStep;

                          return (
                            <div
                              key={step.id}
                              className={`p-4 rounded-lg border-2 transition-colors ${
                                isCompleted
                                  ? 'bg-green-600/10 border-green-600/30'
                                  : isCurrent
                                  ? 'bg-primary/10 border-primary/50'
                                  : 'bg-secondary/30 border-border/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {isCompleted ? (
                                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                ) : isLocked ? (
                                  <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
                                ) : (
                                  <Circle className="w-5 h-5 text-primary mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className={`font-medium ${isLocked ? 'text-muted-foreground' : ''}`}>
                                    {step.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {step.description}
                                  </p>
                                  {!isLocked && (
                                    <div className="flex items-center gap-3 mt-2 text-xs">
                                      {step.reward_coins > 0 && (
                                        <span className="text-accent">+{step.reward_coins} монет</span>
                                      )}
                                      {step.reward_xp > 0 && (
                                        <span className="text-primary">+{step.reward_xp} XP</span>
                                      )}
                                      {step.reward_gems > 0 && (
                                        <span className="text-accent">+{step.reward_gems} гемов</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!progress && (
                        <button
                          onClick={() => startMutation.mutate(selectedChain)}
                          disabled={startMutation.isPending}
                          className="w-full py-3 bg-gradient-brand shadow-soft rounded-xl font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Play className="w-5 h-5" />
                          {startMutation.isPending ? 'Запуск...' : 'Начать квест'}
                        </button>
                      )}

                      {progress?.is_completed && (
                        <div className="text-center p-4 bg-green-600/10 rounded-xl border border-green-600/30">
                          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                          <p className="font-bold text-green-400">Квест завершён!</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="glass rounded-xl p-8 text-center sticky top-6">
                <Scroll className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Выберите квест, чтобы увидеть шаги</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
