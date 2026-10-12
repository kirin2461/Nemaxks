import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useStore } from "../lib/store";
import { messagesAPI } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { useLanguage } from "../contexts/LanguageContext";
import { ArrowLeft, Phone, Video, MoreVertical, MessageSquare } from "lucide-react";

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  updated_at?: string;
}

interface Message {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  content: string;
  created_at: string;
}

const DirectMessagesPage: React.FC = () => {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user: currentUser } = useStore();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!userId || !currentUser?.id) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await messagesAPI.getMessages(userId, 50, 0);
        if (Array.isArray(response)) {
          setMessages(response as DirectMessage[]);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [userId, currentUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser?.id || !userId) return;

    const connectWebSocket = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log("WebSocket connected");
          wsRef.current?.send(
            JSON.stringify({
              type: "subscribe",
              userId: currentUser.id,
            }),
          );
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "message:new") {
              const msg = data.message as Message;
              setMessages((prev) => [...prev, {
                ...msg,
                sender_id: msg.sender_id || '',
                receiver_id: msg.receiver_id || '',
              } as DirectMessage]);
            } else if (data.type === "message:delete") {
              setMessages((prev) =>
                prev.filter((m) => m.id !== data.messageId),
              );
            } else if (data.type === "message:edit") {
              const msg = data.message as Message;
              setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? {
                  ...msg,
                  sender_id: msg.sender_id || m.sender_id,
                  receiver_id: msg.receiver_id || m.receiver_id,
                } as DirectMessage : m)),
              );
            } else if (data.type === "typing") {
              setTyping(true);
              setTimeout(() => setTyping(false), 2000);
            }
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        wsRef.current.onclose = () => {
          console.log("WebSocket disconnected");
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser?.id, userId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !currentUser?.id) return;

    try {
      const message = await messagesAPI.sendMessage(userId, newMessage);
      setMessages((prev) => [...prev, message as DirectMessage]);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messagesAPI.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    try {
      const updated = await messagesAPI.updateMessage(messageId, newContent);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? updated as DirectMessage : m)),
      );
    } catch (error) {
      console.error("Failed to update message:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-muted-foreground">{t('messages.loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="sticky top-0 z-10 shrink-0 flex items-center gap-3 px-3 py-3 border-b border-border/60 bg-card/70 backdrop-blur-xl">
        <button
          onClick={() => navigate('/friends')}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar size="sm" userId={userId} alt={`User ${userId}`} />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold tracking-tight text-foreground text-sm truncate">User {userId}</h2>
          <span className="text-xs text-muted-foreground">{t('messages.directMessage') || 'Личное сообщение'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-primary/70" />
            </div>
            <p className="text-sm">{t('messages.noMessages')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 animate-fade-in ${
                message.sender_id === currentUser?.id
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              {message.sender_id !== currentUser?.id && <Avatar size="sm" />}
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-soft transition-shadow duration-200 ${
                  message.sender_id === currentUser?.id
                    ? "bg-gradient-brand text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/60 text-card-foreground rounded-bl-md"
                }`}
              >
                {editingId === message.id ? (
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEditMessage(message.id, editContent)
                          setEditingId(null)
                        }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="bg-background/40 border border-border rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                    <button onClick={() => { handleEditMessage(message.id, editContent); setEditingId(null) }} className="text-xs text-green-400 hover:text-green-300 shrink-0">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">✕</button>
                  </div>
                ) : (
                  <p className="break-words">{message.content}</p>
                )}
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
              {message.sender_id === currentUser?.id && (
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => { setEditingId(message.id); setEditContent(message.content) }}
                    className="text-xs sm:text-sm text-muted-foreground hover:text-foreground p-1"
                  >
                    {t('messages.edit')}
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="text-xs sm:text-sm text-red-400 hover:text-red-300 p-1"
                  >
                    {t('messages.delete')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {typing && (
          <div className="flex gap-3 text-muted-foreground text-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></div>
            </div>
            <span>{t('messages.typing')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="border-t border-border/60 p-3 md:p-4 shrink-0 sticky bottom-16 lg:bottom-0 bg-card/70 backdrop-blur-xl z-10"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('messages.placeholder')}
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-gradient-brand text-primary-foreground px-6 py-2 rounded-xl font-medium shadow-soft hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {t('messages.send')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DirectMessagesPage;
