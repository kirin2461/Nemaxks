import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-56 rounded-lg" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <GraduationCap className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Наставничество</h1>
            <p className="text-sm text-muted-foreground">Учитесь у опытных пользователей</p>
          </div>
        </div>

        {myMentorship?.mentorship ? (
          <div className="rounded-xl border border-emerald-200 bg-accent/30 shadow-soft p-6 mb-8 animate-rise-in">
            <h2 className="text-xl font-display font-bold text-graphite-900 mb-4">Ваше наставничество</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 ring-1 ring-border flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {(myMentorship.mentorship as any).mentor_id === user?.id ? 'Вы наставник у' : 'Ваш наставник'}
                </p>
                <p className="text-emerald-700 text-xl font-display font-bold">
                  {(myMentorship.mentorship as any).mentor_id === user?.id
                    ? (myMentorship.mentorship as any).mentee?.username
                    : (myMentorship.mentorship as any).mentor?.username}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-graphite-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                Текущие задачи
              </h3>
              {(myMentorship.progress as (MentorTask & { is_completed?: boolean })[])?.map((task, index) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border transition-colors duration-150 animate-rise-in ${
                    task.is_completed ? 'bg-success-soft border-emerald-200' : 'bg-card border-border'
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-graphite-900">{task.name}</span>
                    {task.is_completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>+{task.mentor_xp} XP наставнику</span>
                    <span>+{task.mentee_coins} монет ученику</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-soft p-6 mb-8 animate-rise-in">
            <h2 className="text-xl font-display font-bold text-graphite-900 mb-2">Найдите наставника</h2>
            <p className="text-sm text-muted-foreground">
              Свяжитесь с опытными пользователями, которые помогут вам освоиться в Nebula.
            </p>
          </div>
        )}

        <h2 className="text-xl font-display font-bold text-graphite-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
          Доступные наставники
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {mentors.map((mentor: Mentor, index: number) => (
            <div
              key={mentor.id}
              className="rounded-xl border border-border bg-card shadow-soft p-5 transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-700 text-white ring-1 ring-border flex items-center justify-center shrink-0 overflow-hidden">
                  {mentor.avatar ? (
                    <img src={mentor.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <GraduationCap className="w-6 h-6" strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-graphite-900">{mentor.username}</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                      Уровень {mentor.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <Star className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                    <span className="font-mono text-xs">{mentor.mentee_count || 0} учеников</span>
                  </div>
                  <button
                    onClick={() => requestMutation.mutate(mentor.id)}
                    disabled={requestMutation.isPending || !!myMentorship?.mentorship}
                    className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Запросить наставника
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {mentors.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <GraduationCap className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">Станьте первым ментором</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">
              Станьте наставником, достигнув 10 уровня!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
