import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scroll, ChevronRight, CheckCircle, Circle, Coins, Star, Gift, Lock, Play, CheckCircle2 } from 'lucide-react';
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
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-64 rounded-lg" />
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
      <div className="max-w-6xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <Scroll className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Цепочки квестов</h1>
            <p className="text-sm text-muted-foreground">Проходите шаги и забирайте награды</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {chains.map((chain, index) => {
              const progress = getProgress(chain.id);
              const isStarted = !!progress;
              const isCompleted = progress?.is_completed;
              const finalReward = parseFinalReward(chain.final_reward);

              return (
                <div
                  key={chain.id}
                  className={`rounded-xl bg-card border shadow-soft cursor-pointer transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 ${
                    selectedChain === chain.id ? 'border-primary' : 'border-border'
                  } ${isCompleted ? 'bg-accent/30 border-emerald-200' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 80}ms` }}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-secondary grid place-items-center text-2xl">
                          {getCategoryIcon(chain.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-graphite-900">{chain.name}</h3>
                            {isCompleted && (
                              <CheckCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm mb-3">{chain.description}</p>

                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <span className="text-muted-foreground font-mono text-xs">
                              {progress?.current_step || 0}/{chain.total_steps} шагов
                            </span>
                            {finalReward.coins && (
                              <div className="flex items-center gap-1 text-graphite-600">
                                <Coins className="w-4 h-4" strokeWidth={1.75} />
                                <span>{finalReward.coins}</span>
                              </div>
                            )}
                            {finalReward.gems && (
                              <div className="flex items-center gap-1 text-emerald-700">
                                <Gift className="w-4 h-4" strokeWidth={1.75} />
                                <span>{finalReward.gems}</span>
                              </div>
                            )}
                            {finalReward.xp && (
                              <div className="flex items-center gap-1 text-emerald-700">
                                <Star className="w-4 h-4" strokeWidth={1.75} />
                                <span>{finalReward.xp} XP</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    </div>

                    {isStarted && !isCompleted && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Прогресс</span>
                          <span className="text-emerald-700 font-mono">
                            {Math.round(((progress?.current_step || 1) / chain.total_steps) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-graphite-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-2 rounded-full animate-bar-grow origin-left"
                            style={{
                              width: `${((progress?.current_step || 1) / chain.total_steps) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {chains.length === 0 && (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4 text-graphite-900">Все задания выполнены</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Квесты пока недоступны</p>
              </div>
            )}
          </div>

          <div>
            {selectedChain ? (
              <div className="rounded-xl border border-border bg-card shadow-soft p-6 sticky top-6 animate-rise-in" key={selectedChain}>
                <h3 className="text-lg font-semibold text-graphite-900 mb-4">Шаги квеста</h3>

                {(() => {
                  const chain = chains.find(c => c.id === selectedChain);
                  const progress = getProgress(selectedChain);
                  const currentStep = progress?.current_step || 0;

                  return (
                    <>
                      <div className="relative mb-6">
                        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                        <div className="space-y-3">
                          {steps.map((step, idx) => {
                            const isCompleted = idx + 1 < currentStep;
                            const isCurrent = idx + 1 === currentStep;
                            const isLocked = idx + 1 > currentStep;

                            return (
                              <div
                                key={step.id}
                                className={`relative ml-6 p-4 rounded-lg border transition-colors duration-150 animate-rise-in ${
                                  isCompleted
                                    ? 'bg-success-soft border-emerald-200'
                                    : isCurrent
                                    ? 'bg-accent border-emerald-300'
                                    : 'bg-secondary border-border'
                                }`}
                                style={{ animationDelay: `${Math.min(idx, 8) * 80}ms` }}
                              >
                                <span className={`absolute -left-6 top-4 h-[18px] w-[18px] rounded-full border-2 grid place-items-center ${
                                  isCompleted
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : isCurrent
                                    ? 'bg-card border-primary'
                                    : 'bg-card border-graphite-300'
                                }`}>
                                  {isCompleted && <CheckCircle className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                </span>
                                <div className="flex items-start gap-3">
                                  {isCompleted ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={2} />
                                  ) : isLocked ? (
                                    <Lock className="w-5 h-5 text-graphite-400 mt-0.5 shrink-0" strokeWidth={1.75} />
                                  ) : (
                                    <Circle className="w-5 h-5 text-primary mt-0.5 shrink-0" strokeWidth={1.75} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-medium text-sm ${isLocked ? 'text-muted-foreground' : 'text-graphite-900'}`}>
                                      {step.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {step.description}
                                    </p>
                                    {!isLocked && (
                                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                                        {step.reward_coins > 0 && (
                                          <span className="text-graphite-600">+{step.reward_coins} монет</span>
                                        )}
                                        {step.reward_xp > 0 && (
                                          <span className="text-emerald-700">+{step.reward_xp} XP</span>
                                        )}
                                        {step.reward_gems > 0 && (
                                          <span className="text-emerald-700">+{step.reward_gems} гемов</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {!progress && (
                        <button
                          onClick={() => startMutation.mutate(selectedChain)}
                          disabled={startMutation.isPending}
                          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <Play className="w-5 h-5" strokeWidth={1.75} />
                          {startMutation.isPending ? 'Запуск...' : 'Начать квест'}
                        </button>
                      )}

                      {progress?.is_completed && (
                        <div className="text-center p-4 bg-success-soft rounded-xl border border-emerald-200 animate-scale-in">
                          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" strokeWidth={1.75} />
                          <p className="font-semibold text-emerald-800">Квест завершён!</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center sticky top-6">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Scroll className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground mt-4 max-w-[320px] mx-auto">Выберите квест, чтобы увидеть шаги</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
