import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Brain, Clock, Coins, Star, Trophy, CheckCircle, XCircle, Timer, X } from 'lucide-react';
import { miniGamesAPI, MiniGame, GameSession, TriviaQuestion } from '../lib/api';

export default function MiniGamesPage() {
  const queryClient = useQueryClient();
  const [activeGame, setActiveGame] = useState<{
    session: GameSession;
    game: MiniGame;
    questions?: TriviaQuestion[];
  } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['minigames'],
    queryFn: () => miniGamesAPI.getAll(),
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => miniGamesAPI.start(id),
    onSuccess: (data) => {
      setActiveGame({
        session: data.session,
        game: data.game,
        questions: data.game_data,
      });
      setCurrentQuestion(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setGameComplete(false);
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ sessionId, finalScore }: { sessionId: number; finalScore: number }) =>
      miniGamesAPI.complete(sessionId, finalScore),
    onSuccess: () => {
      setGameComplete(true);
      queryClient.invalidateQueries({ queryKey: ['currency'] });
    },
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success-soft text-emerald-800';
      case 'medium': return 'bg-warning-soft text-[hsl(32_95%_30%)]';
      case 'hard': return 'bg-danger-soft text-destructive';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getGameIcon = (gameType: string) => {
    switch (gameType) {
      case 'trivia': return Brain;
      case 'typing': return Timer;
      default: return Gamepad2;
    }
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || !activeGame?.questions) return;

    setSelectedAnswer(idx);
    const question = activeGame.questions[currentQuestion];
    const correct = idx === question.correct_idx;

    if (correct) {
      setScore(prev => prev + question.points);
    }

    setShowResult(true);

    setTimeout(() => {
      if (currentQuestion < activeGame.questions!.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setShowResult(false);
      } else {
        const finalScore = correct ? score + question.points : score;
        completeMutation.mutate({
          sessionId: activeGame.session.id,
          finalScore,
        });
      }
    }, 1500);
  };

  const exitGame = () => {
    setActiveGame(null);
    setGameComplete(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-48 rounded-lg" />
          <div className="grid md:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton h-44 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeGame && !gameComplete) {
    const question = activeGame.questions?.[currentQuestion];
    const options = question ? JSON.parse(question.options) : [];

    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
        <div className="max-w-2xl mx-auto animate-rise-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
              <span className="text-lg font-semibold text-graphite-900">{activeGame.game.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-graphite-900">
                <Coins className="w-5 h-5 text-graphite-600" strokeWidth={1.75} />
                <span key={score} className="font-mono font-semibold animate-count-flick inline-block">{score}</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {currentQuestion + 1}/{activeGame.questions?.length || 0}
              </span>
              <button
                onClick={exitGame}
                className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                aria-label="Выйти из игры"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-8">
            <div className="mb-4">
              <div className="w-full bg-graphite-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentQuestion + 1) / (activeGame.questions?.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div key={currentQuestion} className="animate-rise-in">
              <h2 className="text-xl font-display font-bold text-graphite-900 mb-6">{question?.question}</h2>

              <div className="space-y-3">
                {options.map((option: string, idx: number) => {
                  const isSelected = selectedAnswer === idx;
                  const isCorrect = idx === question?.correct_idx;
                  const showCorrect = showResult && isCorrect;
                  const showWrong = showResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={selectedAnswer !== null}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-150 flex items-center justify-between gap-3 text-sm ${
                        showCorrect
                          ? 'bg-success-soft border-2 border-emerald-600'
                          : showWrong
                          ? 'bg-danger-soft border-2 border-destructive'
                          : isSelected
                          ? 'bg-accent border-2 border-primary'
                          : 'bg-secondary hover:bg-graphite-200 border-2 border-transparent'
                      }`}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={2} />}
                      {showWrong && <XCircle className="w-5 h-5 text-destructive shrink-0" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={exitGame}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Выйти из игры
          </button>
        </div>
      </div>
    );
  }

  if (gameComplete && completeMutation.data) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card shadow-pop p-8 text-center max-w-md w-full animate-scale-in">
          <div className="h-20 w-20 rounded-2xl bg-accent grid place-items-center mx-auto mb-4">
            <Trophy className="w-12 h-12 text-emerald-600" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-display font-bold text-graphite-900 mb-2">Игра завершена!</h2>
          <p className="text-sm text-muted-foreground mb-6">Отличная игра!</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Очки</p>
              <p className="text-2xl font-display font-bold text-graphite-900">{score}</p>
            </div>
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Монет заработано</p>
              <p className="text-2xl font-display font-bold text-emerald-700">+{completeMutation.data.coins_earned}</p>
            </div>
          </div>

          <div className="bg-accent rounded-lg p-4 mb-6 border border-emerald-200">
            <p className="text-xs text-emerald-800 mb-1">Получено XP</p>
            <p className="text-xl font-display font-bold text-emerald-800">+{completeMutation.data.xp_earned} XP</p>
          </div>

          <button
            onClick={exitGame}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97]"
          >
            Назад к играм
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <Gamepad2 className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Мини-игры</h1>
            <p className="text-sm text-muted-foreground">Играйте и зарабатывайте награды</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {games.map((game, index) => {
            const GameIcon = getGameIcon(game.game_type);
            return (
              <div
                key={game.id}
                className="group rounded-xl border border-border bg-card shadow-soft overflow-hidden transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300"
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <div className="aspect-[4/3] max-h-40 bg-graphite-100 grid place-items-center">
                  <GameIcon className="w-10 h-10 text-graphite-500 transition-all duration-150 group-hover:text-emerald-600 group-hover:scale-110" strokeWidth={1.5} />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-graphite-900">{game.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(game.difficulty)}`}>
                      {game.difficulty === 'easy' ? 'легко' : game.difficulty === 'medium' ? 'средне' : game.difficulty === 'hard' ? 'сложно' : game.difficulty}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">{game.description}</p>

                  <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                    <div className="flex items-center gap-1 text-graphite-600">
                      <Coins className="w-4 h-4" strokeWidth={1.75} />
                      <span>+{game.coin_reward}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-700">
                      <Star className="w-4 h-4" strokeWidth={1.75} />
                      <span>+{game.xp_reward} XP</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" strokeWidth={1.75} />
                      <span>перезарядка {game.cooldown_min} мин</span>
                    </div>
                  </div>

                  <button
                    onClick={() => startMutation.mutate(game.id)}
                    disabled={startMutation.isPending}
                    className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {startMutation.isPending ? 'Запуск...' : 'Играть'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {games.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <Gamepad2 className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">Игры пока недоступны</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Загляните позже</p>
          </div>
        )}
      </div>
    </div>
  );
}
