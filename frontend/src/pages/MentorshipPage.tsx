import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Target, CheckCircle, Clock, Star } from 'lucide-react';
import { mentorshipAPI, Mentorship } from '../lib/api';
import { useStore } from '../lib/store';

interface Mentor {
  id: number;
  username: string;
  avatar?: string;
  level: number;
  mentee_count?: number;
}

interface MentorTask {
  id: number;
  name: string;
  description: string;
  mentor_xp: number;
  mentee_coins: number;
  is_completed?: boolean;
}

export default function MentorshipPage() {
  const queryClient = useQueryClient();
  const { user } = useStore();
  const [selectedMentor, setSelectedMentor] = useState<number | null>(null);

  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ['mentors'],
    queryFn: () => mentorshipAPI.getMentors(),
  });

  const { data: myMentorship } = useQuery({
    queryKey: ['my-mentorship'],
    queryFn: () => mentorshipAPI.getMy(),
  });

  const requestMutation = useMutation({
    mutationFn: (mentorId: number) => mentorshipAPI.request(mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-mentorship'] });
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      setSelectedMentor(null);
    },
  });

  if (isLoading) {
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
          <GraduationCap className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold gradient-brand-text">Наставничество</h1>
        </div>

        {myMentorship?.mentorship ? (
          <div className="glass rounded-xl p-6 mb-8 border border-primary/30">
            <h2 className="text-xl font-bold mb-4">Ваше наставничество</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-lg">
                  {(myMentorship.mentorship as any).mentor_id === user?.id ? 'Вы наставник у' : 'Ваш наставник'}
                </p>
                <p className="text-primary text-xl font-bold">
                  {(myMentorship.mentorship as any).mentor_id === user?.id
                    ? (myMentorship.mentorship as any).mentee?.username
                    : (myMentorship.mentorship as any).mentor?.username}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Текущие задачи
              </h3>
              {(myMentorship.progress as (MentorTask & { is_completed?: boolean })[])?.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg ${
                    task.is_completed ? 'bg-green-500/15 border border-green-500/30' : 'bg-card/50 border border-border/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{task.name}</span>
                    {task.is_completed ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>+{task.mentor_xp} XP наставнику</span>
                    <span>+{task.mentee_coins} монет ученику</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-2">Найдите наставника</h2>
            <p className="text-muted-foreground">
              Свяжитесь с опытными пользователями, которые помогут вам освоиться в Nebula.
            </p>
          </div>
        )}

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Доступные наставники
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {mentors.map((mentor: Mentor) => (
            <motion.div
              key={mentor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5 hover:shadow-glow transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{mentor.username}</span>
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded">
                      Уровень {mentor.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <Star className="w-4 h-4 text-accent" />
                    <span>{mentor.mentee_count || 0} учеников</span>
                  </div>
                  <button
                    onClick={() => requestMutation.mutate(mentor.id)}
                    disabled={requestMutation.isPending || !!myMentorship?.mentorship}
                    className="w-full py-2 bg-gradient-brand text-white rounded-lg font-medium shadow-soft hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    Запросить наставника
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {mentors.length === 0 && (
          <div className="glass rounded-xl p-12 text-center">
            <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Нет доступных наставников</h3>
            <p className="text-muted-foreground">
              Станьте наставником, достигнув 10 уровня!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
