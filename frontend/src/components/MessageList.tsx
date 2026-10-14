'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Smile, MoreVertical, Play, Pause, Phone, Video, PhoneMissed } from 'lucide-react';

// Метаданные системного сообщения о звонке (content = JSON, см. backend createDMCallSystemMessage)
export interface CallMessageMeta {
  kind?: 'audio' | 'video';
  duration_sec?: number;
  status?: 'completed' | 'missed';
}

export function parseCallMeta(content: string): CallMessageMeta | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') return parsed as CallMessageMeta;
  } catch {
    // не JSON — не карточка звонка
  }
  return null;
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// CallCard — карточка звонка в ленте диалога («Звонок · 3:24» / «Пропущенный»)
export const CallCard: React.FC<{ content: string }> = ({ content }) => {
  const meta = parseCallMeta(content) || {};
  const missed = meta.status === 'missed';
  const Icon = missed ? PhoneMissed : meta.kind === 'audio' ? Phone : Video;
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        missed ? 'bg-red-500/15 text-red-400' : 'bg-primary/10 text-primary'
      }`}>
        <Icon size={15} />
      </div>
      <div className="text-sm">
        <p className={missed ? 'text-red-400 font-medium' : 'font-medium'}>
          {missed ? 'Пропущенный звонок' : meta.kind === 'audio' ? 'Аудиозвонок' : 'Видеозвонок'}
        </p>
        {!missed && typeof meta.duration_sec === 'number' && (
          <p className="text-xs text-muted-foreground">Звонок · {formatCallDuration(meta.duration_sec)}</p>
        )}
      </div>
    </div>
  );
};

// VoiceMessagePlayer — плеер голосового сообщения (Play/Pause, прогресс, длительность)
export const VoiceMessagePlayer: React.FC<{ url: string; duration?: number }> = ({ url, duration = 0 }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [total, setTotal] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      if (isFinite(audio.duration) && audio.duration > 0) setTotal(audio.duration);
    };
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const progress = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center shrink-0 transition-colors"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatCallDuration(Math.floor(playing || currentTime > 0 ? currentTime : total))}
      </span>
    </div>
  );
};

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  type?: 'text' | 'voice' | 'call' | string;
  voiceUrl?: string;
  voiceDuration?: number;
  attachments?: Array<{ id: string; name: string; url: string; size: number }>;
  reactions?: { emoji: string; users: string[] }[];
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  replyTo?: string;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  currentUsername: string;
  onSendMessage: (content: string, attachments?: string[]) => Promise<void>;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReaction?: (messageId: string, emoji: string) => Promise<void>;
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  currentUsername,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  isLoading,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setSending(true);
    try {
      await onSendMessage(inputValue);
      setInputValue('');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  let lastDate = '';

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground rounded-xl border border-border overflow-hidden">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="w-7 h-7 text-primary/70" />
            </div>
            <p className="text-sm">No messages yet. Start a conversation!</p>
          </div>
        )}

        {messages.map((message, index) => {
          const messageDate = formatDate(message.createdAt);
          const showDate = messageDate !== lastDate;
          if (showDate) lastDate = messageDate;

          const isOwn = message.userId === currentUserId;

          return (
            <div key={message.id}>
              {showDate && (
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 border-t border-border"></div>
                  <span className="text-xs text-muted-foreground px-2">{messageDate}</span>
                  <div className="flex-1 border-t border-border"></div>
                </div>
              )}

              <div className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {message.avatar ? (
                    <img
                      src={message.avatar}
                      alt={message.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs text-primary-foreground font-semibold shadow-soft">
                      {message.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{message.username}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                    {message.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                  </div>

                  <div
                    className={`inline-block max-w-xs px-4 py-2 rounded-2xl transition-shadow duration-200 hover:shadow-soft ${
                      isOwn
                        ? 'bg-gradient-brand text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border/60 text-card-foreground rounded-bl-md'
                    }`}
                  >
                    {message.type === 'call' ? (
                      <CallCard content={message.content} />
                    ) : message.type === 'voice' && message.voiceUrl ? (
                      <VoiceMessagePlayer url={message.voiceUrl} duration={message.voiceDuration} />
                    ) : (
                      <p className="break-words text-sm">{message.content}</p>
                    )}

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 text-xs underline ${
                              isOwn ? 'text-primary-foreground/80' : 'text-primary'
                            }`}
                          >
                            <Paperclip size={12} />
                            {attachment.name} ({(attachment.size / 1024).toFixed(1)}KB)
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {message.reactions.map((reaction, idx) => (
                        <button
                          key={idx}
                          onClick={() => onReaction?.(message.id, reaction.emoji)}
                          className="px-2.5 py-1 text-xs bg-secondary/80 rounded-full hover:bg-primary/20 border border-transparent hover:border-primary/40 transition-colors"
                        >
                          {reaction.emoji} {reaction.users.length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Actions */}
                {isOwn && (
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition">
                    <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                      <MoreVertical size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/60 p-4 bg-card/60 backdrop-blur-xl">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="input-field flex-1"
          />

          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Smile size={20} />
          </button>

          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="px-4 py-2 bg-gradient-brand text-primary-foreground rounded-xl shadow-soft hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageList;
