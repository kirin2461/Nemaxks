import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Clock, BarChart3 } from 'lucide-react';
import { pollsAPI } from '../lib/api';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: number;
  guildId?: number;
  onCreated?: () => void;
  language?: 'en' | 'ru';
}

const DURATION_OPTIONS = [
  { value: 0, label: { en: 'No limit', ru: 'Без ограничения' } },
  { value: 3600, label: { en: '1 hour', ru: '1 час' } },
  { value: 86400, label: { en: '1 day', ru: '1 день' } },
  { value: 604800, label: { en: '1 week', ru: '1 неделя' } },
];

export default function CreatePollModal({
  isOpen,
  onClose,
  channelId,
  guildId,
  onCreated,
  language = 'ru',
}: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiChoice, setMultiChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [duration, setDuration] = useState(86400);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    setError('');
    
    const validOptions = options.filter(o => o.trim());
    if (!question.trim()) {
      setError(language === 'ru' ? 'Введите вопрос' : 'Enter a question');
      return;
    }
    if (validOptions.length < 2) {
      setError(language === 'ru' ? 'Минимум 2 варианта ответа' : 'At least 2 options required');
      return;
    }

    setCreating(true);
    try {
      await pollsAPI.create({
        channel_id: channelId,
        guild_id: guildId,
        question: question.trim(),
        description: description.trim(),
        options: validOptions,
        multi_choice: multiChoice,
        anonymous,
        duration: duration > 0 ? duration : undefined,
      });
      
      setQuestion('');
      setDescription('');
      setOptions(['', '']);
      setMultiChoice(false);
      setAnonymous(false);
      setDuration(86400);
      
      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create poll');
    }
    setCreating(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-pop border border-border max-h-[90vh] overflow-y-auto animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {language === 'ru' ? 'Создать опрос' : 'Create Poll'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-soft border border-destructive/40 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {language === 'ru' ? 'Вопрос' : 'Question'} *
              </label>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={language === 'ru' ? 'О чём спросить?' : 'What do you want to ask?'}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder-muted-foreground focus:border-primary focus:ring-4 focus:ring-emerald-600/10 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {language === 'ru' ? 'Описание (опционально)' : 'Description (optional)'}
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={language === 'ru' ? 'Дополнительная информация...' : 'Additional context...'}
                maxLength={500}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder-muted-foreground focus:border-primary focus:ring-4 focus:ring-emerald-600/10 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {language === 'ru' ? 'Варианты ответа' : 'Answer options'} *
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={e => updateOption(index, e.target.value)}
                      placeholder={`${language === 'ru' ? 'Вариант' : 'Option'} ${index + 1}`}
                      maxLength={100}
                      className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:border-primary outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 rounded-lg bg-secondary hover:bg-[hsl(0_72%_38%])/50 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {options.length < 10 && (
                <button
                  onClick={addOption}
                  className="mt-2 w-full px-4 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'ru' ? 'Добавить вариант' : 'Add option'}
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                <Clock className="w-4 h-4 inline-block mr-1" />
                {language === 'ru' ? 'Длительность' : 'Duration'}
              </label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:border-primary outline-none"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label[language]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiChoice}
                  onChange={e => setMultiChoice(e.target.checked)}
                  className="w-5 h-5 rounded border-border bg-secondary text-emerald-700 focus:ring-emerald-600/10"
                />
                <span className="text-sm text-foreground">
                  {language === 'ru' ? 'Множественный выбор' : 'Multiple choice'}
                </span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={e => setAnonymous(e.target.checked)}
                  className="w-5 h-5 rounded border-border bg-secondary text-emerald-700 focus:ring-emerald-600/10"
                />
                <span className="text-sm text-foreground">
                  {language === 'ru' ? 'Анонимный опрос' : 'Anonymous poll'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-secondary text-foreground font-semibold hover:bg-muted transition-colors"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {language === 'ru' ? 'Создание...' : 'Creating...'}
                </span>
              ) : (
                language === 'ru' ? 'Создать опрос' : 'Create Poll'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
