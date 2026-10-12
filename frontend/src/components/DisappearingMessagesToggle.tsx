import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Timer } from 'lucide-react';
import { disappearingAPI } from '../lib/api';

interface DisappearingMessagesToggleProps {
  otherUserId: number;
  language?: 'en' | 'ru';
}

const DURATION_OPTIONS = [
  { value: 60, label: { en: '1 minute', ru: '1 минута' } },
  { value: 300, label: { en: '5 minutes', ru: '5 минут' } },
  { value: 3600, label: { en: '1 hour', ru: '1 час' } },
  { value: 86400, label: { en: '1 day', ru: '1 день' } },
  { value: 604800, label: { en: '1 week', ru: '1 неделя' } },
];

export default function DisappearingMessagesToggle({
  otherUserId,
  language = 'ru',
}: DisappearingMessagesToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [duration, setDuration] = useState(86400);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [otherUserId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const settings = await disappearingAPI.getSettings(otherUserId);
      setEnabled(settings.enabled);
      setDuration(settings.duration);
    } catch (error) {
      console.error('Failed to load disappearing settings:', error);
    }
    setLoading(false);
  }

  const handleToggle = async () => {
    setSaving(true);
    try {
      await disappearingAPI.updateSettings(otherUserId, {
        enabled: !enabled,
        duration,
      });
      setEnabled(!enabled);
    } catch (error) {
      console.error('Failed to toggle disappearing messages:', error);
    }
    setSaving(false);
  };

  const handleDurationChange = async (newDuration: number) => {
    setDuration(newDuration);
    if (enabled) {
      setSaving(true);
      try {
        await disappearingAPI.updateSettings(otherUserId, {
          enabled: true,
          duration: newDuration,
        });
      } catch (error) {
        console.error('Failed to update duration:', error);
      }
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-card/50 rounded-xl animate-pulse">
        <div className="h-6 w-48 bg-secondary rounded"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            enabled ? 'bg-purple-600' : 'bg-secondary'
          }`}>
            <Timer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {language === 'ru' ? 'Исчезающие сообщения' : 'Disappearing Messages'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {enabled 
                ? (language === 'ru' ? 'Сообщения удаляются автоматически' : 'Messages are auto-deleted')
                : (language === 'ru' ? 'Сообщения сохраняются' : 'Messages are kept')
              }
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            enabled ? 'bg-purple-600' : 'bg-muted'
          } ${saving ? 'opacity-50' : ''}`}
        >
          <motion.div
            animate={{ x: enabled ? 28 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-5 h-5 rounded-full bg-white"
          />
        </button>
      </div>
      
      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 pt-3 border-t border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {language === 'ru' ? 'Удалять через:' : 'Delete after:'}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleDurationChange(opt.value)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  duration === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-secondary text-foreground hover:bg-muted'
                }`}
              >
                {opt.label[language]}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
