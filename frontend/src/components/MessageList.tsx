'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react';

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
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
    <div className="w-full h-full flex flex-col bg-card text-card-foreground rounded-lg border border-border">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start a conversation!</p>
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white font-semibold">
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
                    className={`inline-block max-w-xs px-4 py-2 rounded-lg ${
                      isOwn
                        ? 'bg-blue-500 text-white'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <p className="break-words text-sm">{message.content}</p>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 text-xs underline ${
                              isOwn ? 'text-blue-100' : 'text-blue-600'
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
                          className="px-2 py-1 text-xs bg-secondary rounded hover:bg-muted transition"
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
                    <button className="p-1 hover:bg-secondary rounded">
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
      <div className="border-t border-border p-4 bg-card">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-secondary rounded transition"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-yellow-500 hover:bg-secondary rounded transition"
          >
            <Smile size={20} />
          </button>

          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-muted transition font-medium"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageList;
