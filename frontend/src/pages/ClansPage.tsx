import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Crown, Target, Lock, Globe, ChevronRight } from 'lucide-react';
import { clansAPI, Clan, ClanChallenge } from '../lib/api';

export default function ClansPage() {
  const queryClient = useQueryClient();
  const [selectedGuildId, setSelectedGuildId] = useState<number>(1);
  const [selectedClan, setSelectedClan] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanDesc, setNewClanDesc] = useState('');
  const [newClanColor, setNewClanColor] = useState('#6366f1');
  const [newClanPublic, setNewClanPublic] = useState(true);

  const { data: clans = [], isLoading } = useQuery({
    queryKey: ['clans', selectedGuildId],
    queryFn: () => clansAPI.getGuildClans(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['clan-challenges', selectedClan],
    queryFn: () => clansAPI.getChallenges(selectedClan!),
    enabled: !!selectedClan,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      clansAPI.create({
        guild_id: selectedGuildId,
        name: newClanName,
        description: newClanDesc,
        color: newClanColor,
        is_public: newClanPublic,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
      setShowCreateModal(false);
      setNewClanName('');
      setNewClanDesc('');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (clanId: number) => clansAPI.join(clanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-bold">Clans</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Create Clan
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {clans.map((clan: Clan) => (
              <motion.div
                key={clan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-xl p-6 cursor-pointer hover:bg-gray-750 transition-colors"
                onClick={() => setSelectedClan(clan.id)}
                style={{ borderLeft: `4px solid ${clan.color}` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                      style={{ backgroundColor: `${clan.color}20`, color: clan.color }}
                    >
                      {clan.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">{clan.name}</h3>
                        {clan.is_public ? (
                          <Globe className="w-4 h-4 text-green-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{clan.description || 'No description'}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Crown className="w-4 h-4 text-yellow-400" />
                          {clan.leader?.username || 'Unknown'}
                        </div>
                        <span>{clan.total_xp.toLocaleString()} XP</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {clan.is_public && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      joinMutation.mutate(clan.id);
                    }}
                    disabled={joinMutation.isPending}
                    className="mt-4 w-full py-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30"
                  >
                    Join Clan
                  </button>
                )}
              </motion.div>
            ))}

            {clans.length === 0 && (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No clans yet</h3>
                <p className="text-gray-400">Be the first to create a clan!</p>
              </div>
            )}
          </div>

          <div>
            {selectedClan ? (
              <div className="bg-gray-800 rounded-xl p-6 sticky top-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  Clan Challenges
                </h3>
                <div className="space-y-3">
                  {challenges.map((challenge: ClanChallenge) => (
                    <div key={challenge.id} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{challenge.name}</span>
                        {challenge.is_completed && (
                          <span className="text-green-400 text-xs">Completed</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{challenge.description}</p>
                      <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          {challenge.progress}/{challenge.goal}
                        </span>
                        <span>+{challenge.reward_coins} coins, +{challenge.reward_xp} XP</span>
                      </div>
                    </div>
                  ))}
                  {challenges.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No active challenges</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center sticky top-6">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a clan to view challenges</p>
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-xl font-bold mb-4">Create Clan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Clan Name</label>
                  <input
                    type="text"
                    value={newClanName}
                    onChange={e => setNewClanName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newClanDesc}
                    onChange={e => setNewClanDesc(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Color</label>
                  <input
                    type="color"
                    value={newClanColor}
                    onChange={e => setNewClanColor(e.target.value)}
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newClanPublic}
                    onChange={e => setNewClanPublic(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Public clan (anyone can join)</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newClanName || createMutation.isPending}
                    className="flex-1 py-2 bg-indigo-600 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
