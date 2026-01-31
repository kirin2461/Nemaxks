import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Check, Clock, Users, Lock } from 'lucide-react';
import { Poll, pollsAPI } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface PollCardProps {
  poll: Poll;
  myVotes?: number[];
  onVote?: () => void;
  language?: 'en' | 'ru';
}

export default function PollCard({ poll, myVotes = [], onVote, language = 'ru' }: PollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<number[]>(myVotes);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(myVotes.length > 0);

  const isExpired = poll.expires_at && new Date(poll.expires_at) < new Date();
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes_count, 0);

  const toggleOption = (optionId: number) => {
    if (hasVoted || poll.is_closed || isExpired) return;
    
    if (poll.multi_choice) {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0 || voting) return;
    
    setVoting(true);
    try {
      await pollsAPI.vote(poll.id, selectedOptions);
      setHasVoted(true);
      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
    setVoting(false);
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-purple-500/20"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{poll.question}</h3>
            {poll.description && (
              <p className="text-sm text-gray-400 mt-1">{poll.description}</p>
            )}
          </div>
        </div>
        
        {poll.anonymous && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
            {language === 'ru' ? 'Анонимно' : 'Anonymous'}
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {poll.options.map(option => {
          const isSelected = selectedOptions.includes(option.id);
          const percentage = getPercentage(option.votes_count);
          const showResults = hasVoted || poll.is_closed || isExpired;
          
          return (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`relative rounded-lg p-3 transition-all cursor-pointer overflow-hidden ${
                isSelected
                  ? 'bg-purple-600/30 border-2 border-purple-500'
                  : 'bg-gray-700/50 border-2 border-transparent hover:border-gray-600'
              } ${(poll.is_closed || isExpired) ? 'cursor-default' : ''}`}
            >
              {showResults && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-0 bg-purple-600/20"
                />
              )}
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-500'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-white">{option.text}</span>
                </div>
                
                {showResults && (
                  <span className="text-sm text-gray-400">
                    {percentage}% ({option.votes_count})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{poll.votes_count} {language === 'ru' ? 'голосов' : 'votes'}</span>
          </div>
          
          {poll.expires_at && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {isExpired
                  ? (language === 'ru' ? 'Завершен' : 'Ended')
                  : formatDistanceToNow(new Date(poll.expires_at), {
                      addSuffix: true,
                      locale: language === 'ru' ? ru : undefined,
                    })}
              </span>
            </div>
          )}
          
          {poll.multi_choice && (
            <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
              {language === 'ru' ? 'Множественный выбор' : 'Multiple choice'}
            </span>
          )}
        </div>
        
        {!hasVoted && !poll.is_closed && !isExpired && (
          <button
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || voting}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {voting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {language === 'ru' ? 'Голосую...' : 'Voting...'}
              </span>
            ) : (
              language === 'ru' ? 'Голосовать' : 'Vote'
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
