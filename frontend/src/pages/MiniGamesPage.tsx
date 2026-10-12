import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Brain, Clock, Coins, Star, Trophy, CheckCircle, XCircle, Timer } from 'lucide-react';
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
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-accent bg-accent/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-muted-foreground bg-muted/30';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary/40" />
      </div>
    );
  }

  if (activeGame && !gameComplete) {
    const question = activeGame.questions?.[currentQuestion];
    const options = question ? JSON.parse(question.options) : [];

    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">{activeGame.game.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-accent">
                <Coins className="w-5 h-5" />
                <span>{score}</span>
              </div>
              <span className="text-muted-foreground">
                {currentQuestion + 1}/{activeGame.questions?.length || 0}
              </span>
            </div>
          </div>

          <div className="bg-card rounded-xl p-8">
            <div className="mb-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-gradient-brand shadow-soft h-2 rounded-full transition-all"
                  style={{
                    width: `${((currentQuestion + 1) / (activeGame.questions?.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-xl font-bold mb-6">{question?.question}</h2>

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
                        className={`w-full p-4 rounded-xl text-left transition-all flex items-center justify-between ${
                          showCorrect
                            ? 'bg-green-600/20 border-2 border-green-500'
                            : showWrong
                            ? 'bg-red-600/20 border-2 border-red-500'
                            : isSelected
                            ? 'bg-primary/20 border-2 border-primary/40'
                            : 'bg-secondary hover:bg-muted border-2 border-transparent'
                        }`}
                      >
                        <span>{option}</span>
                        {showCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {showWrong && <XCircle className="w-5 h-5 text-red-400" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            onClick={exitGame}
            className="mt-6 text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit Game
          </button>
        </div>
      </div>
    );
  }

  if (gameComplete && completeMutation.data) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-xl p-8 text-center max-w-md"
        >
          <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Game Complete!</h2>
          <p className="text-muted-foreground mb-6">Great job playing!</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-bold text-primary">{score}</p>
            </div>
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Coins Earned</p>
              <p className="text-2xl font-bold text-accent">+{completeMutation.data.coins_earned}</p>
            </div>
          </div>

          <div className="bg-primary/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary">XP Earned</p>
            <p className="text-xl font-bold">+{completeMutation.data.xp_earned} XP</p>
          </div>

          <button
            onClick={exitGame}
            className="w-full py-3 bg-gradient-brand shadow-soft rounded-xl font-bold hover:brightness-110"
          >
            Back to Games
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Gamepad2 className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Mini-Games</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {games.map(game => {
            const GameIcon = getGameIcon(game.game_type);
            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl p-6 hover:bg-muted transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <GameIcon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{game.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${getDifficultyColor(game.difficulty)}`}>
                        {game.difficulty}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">{game.description}</p>

                    <div className="flex items-center gap-4 text-sm mb-4">
                      <div className="flex items-center gap-1 text-accent">
                        <Coins className="w-4 h-4" />
                        <span>+{game.coin_reward}</span>
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Star className="w-4 h-4" />
                        <span>+{game.xp_reward} XP</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{game.cooldown_min}m cooldown</span>
                      </div>
                    </div>

                    <button
                      onClick={() => startMutation.mutate(game.id)}
                      disabled={startMutation.isPending}
                      className="w-full py-2 bg-gradient-brand shadow-soft rounded-lg font-medium hover:brightness-110 disabled:opacity-50 transition-colors"
                    >
                      {startMutation.isPending ? 'Starting...' : 'Play Now'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {games.length === 0 && (
          <div className="bg-card rounded-xl p-8 text-center">
            <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No games available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
