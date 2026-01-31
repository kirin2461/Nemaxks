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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <GraduationCap className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl font-bold">Mentorship</h1>
        </div>

        {myMentorship?.mentorship ? (
          <div className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-xl p-6 mb-8 border border-emerald-500/30">
            <h2 className="text-xl font-bold mb-4">Your Mentorship</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-600/30 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-lg">
                  {(myMentorship.mentorship as any).mentor_id === user?.id ? 'You are mentoring' : 'Your mentor is'}
                </p>
                <p className="text-emerald-400 text-xl font-bold">
                  {(myMentorship.mentorship as any).mentor_id === user?.id
                    ? (myMentorship.mentorship as any).mentee?.username
                    : (myMentorship.mentorship as any).mentor?.username}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-gray-300 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Current Tasks
              </h3>
              {myMentorship.progress?.map((task: MentorTask & { is_completed?: boolean }) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg ${
                    task.is_completed ? 'bg-emerald-600/20' : 'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{task.name}</span>
                    {task.is_completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{task.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>+{task.mentor_xp} mentor XP</span>
                    <span>+{task.mentee_coins} mentee coins</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-2">Find a Mentor</h2>
            <p className="text-gray-400">
              Connect with experienced users who can help guide your journey on Nemaks.
            </p>
          </div>
        )}

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          Available Mentors
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {mentors.map((mentor: Mentor) => (
            <motion.div
              key={mentor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{mentor.username}</span>
                    <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded">
                      Level {mentor.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-400 mb-3">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span>{mentor.mentee_count || 0} mentees</span>
                  </div>
                  <button
                    onClick={() => requestMutation.mutate(mentor.id)}
                    disabled={requestMutation.isPending || !!myMentorship?.mentorship}
                    className="w-full py-2 bg-emerald-600 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Request Mentor
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {mentors.length === 0 && (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No mentors available</h3>
            <p className="text-gray-400">
              Become a mentor by reaching level 10!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
