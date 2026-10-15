import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Plus, Trash2 } from 'lucide-react';
import { statusAPI, StatusPreset } from '../lib/api';

interface CustomStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus?: { text: string; emoji: string };
  onUpdate?: (status: { text: string; emoji: string }) => void;
  language?: 'en' | 'ru';
}

const EMOJI_LIST = ['💼', '🎮', '🎧', '📚', '🍔', '😴', '🏃', '✈️', '🎬', '💻', '☕', '🎉', '🤒', '🏠', '📱'];

const DURATION_OPTIONS = [
  { value: 0, label: { en: "Don't clear", ru: 'Не очищать' } },
  { value: 1800, label: { en: '30 minutes', ru: '30 минут' } },
  { value: 3600, label: { en: '1 hour', ru: '1 час' } },
  { value: 14400, label: { en: '4 hours', ru: '4 часа' } },
  { value: 86400, label: { en: 'Today', ru: 'Сегодня' } },
];

export default function CustomStatusModal({ 
  isOpen, 
  onClose, 
  currentStatus,
  onUpdate,
  language = 'ru' 
}: CustomStatusModalProps) {
  const [text, setText] = useState(currentStatus?.text || '');
  const [emoji, setEmoji] = useState(currentStatus?.emoji || '💬');
  const [duration, setDuration] = useState(0);
  const [presets, setPresets] = useState<{ custom: StatusPreset[]; default: StatusPreset[] }>({ custom: [], default: [] });
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen]);

  async function loadPresets() {
    try {
      const data = await statusAPI.getPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await statusAPI.update({ text, emoji, duration: duration > 0 ? duration : undefined });
      onUpdate?.({ text: result.text, emoji: result.emoji });
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await statusAPI.clear();
      onUpdate?.({ text: '', emoji: '' });
      setText('');
      setEmoji('💬');
      onClose();
    } catch (error) {
      console.error('Failed to clear status:', error);
    }
    setSaving(false);
  };

  const handlePresetClick = (preset: StatusPreset) => {
    setText(preset.text);
    setEmoji(preset.emoji);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || !text.trim()) return;
    
    try {
      await statusAPI.createPreset({ name: presetName, text, emoji });
      setShowPresetForm(false);
      setPresetName('');
      loadPresets();
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  const handleDeletePreset = async (id: number) => {
    try {
      await statusAPI.deletePreset(id);
      loadPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
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
          className="bg-card border border-border shadow-pop rounded-xl p-6 max-w-md w-full animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {language === 'ru' ? 'Установить статус' : 'Set Status'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-2">
              {language === 'ru' ? 'Эмодзи' : 'Emoji'}
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_LIST.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    emoji === e 
                      ? 'bg-primary ring-2 ring-primary/60 shadow-lg-brand' 
                      : 'bg-secondary hover:bg-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-2">
              {language === 'ru' ? 'Текст статуса' : 'Status text'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">{emoji}</span>
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={language === 'ru' ? 'Что вы делаете?' : 'What are you doing?'}
                maxLength={100}
                className="input-field pl-12 pr-4 py-3"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-2">
              <Clock className="w-4 h-4 inline-block mr-1" />
              {language === 'ru' ? 'Очистить через' : 'Clear after'}
            </label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="input-field px-4 py-3"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label[language]}
                </option>
              ))}
            </select>
          </div>

          {(presets.default.length > 0 || presets.custom.length > 0) && (
            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-2">
                {language === 'ru' ? 'Быстрый выбор' : 'Quick select'}
              </label>
              <div className="flex flex-wrap gap-2">
                {[...presets.default, ...presets.custom].map((preset, i) => (
                  <div key={preset.id || `default-${i}`} className="relative group">
                    <button
                      onClick={() => handlePresetClick(preset)}
                      className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-sm text-foreground transition-colors"
                    >
                      {preset.emoji} {preset.text}
                    </button>
                    {preset.id && (
                      <button
                        onClick={() => handleDeletePreset(preset.id!)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPresetForm ? (
            <div className="mb-4 p-3 bg-secondary/50 rounded-xl">
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder={language === 'ru' ? 'Название пресета' : 'Preset name'}
                className="input-field px-3 py-2 mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim() || !text.trim()}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-semibold  shadow-lg-brand disabled:opacity-50 transition-all"
                >
                  {language === 'ru' ? 'Сохранить' : 'Save'}
                </button>
                <button
                  onClick={() => setShowPresetForm(false)}
                  className="px-3 py-2 rounded-lg bg-muted text-foreground hover:bg-secondary"
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPresetForm(true)}
              disabled={!text.trim()}
              className="w-full mb-4 px-4 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {language === 'ru' ? 'Сохранить как пресет' : 'Save as preset'}
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleClear}
              disabled={saving}
              className="px-4 py-3 rounded-xl bg-secondary text-foreground font-semibold hover:bg-muted transition-colors"
            >
              {language === 'ru' ? 'Очистить' : 'Clear'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold  shadow-lg-brand disabled:opacity-50 transition-all"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {language === 'ru' ? 'Сохранение...' : 'Saving...'}
                </span>
              ) : (
                language === 'ru' ? 'Сохранить' : 'Save'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
