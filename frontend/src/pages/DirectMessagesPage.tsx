import React, { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useStore } from "../lib/store";
import { messagesAPI } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { useLanguage } from "../contexts/LanguageContext";

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
        <div className="text-xl text-gray-400">{t('messages.loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 pb-20 lg:pb-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>{t('messages.noMessages')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 animate-fadeIn ${
                message.sender_id === currentUser?.id
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              {message.sender_id !== currentUser?.id && <Avatar size="sm" />}
              <div
                className={`max-w-[75%] px-4 py-2 rounded-lg ${
                  message.sender_id === currentUser?.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
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
                      className="bg-transparent border border-gray-500 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button onClick={() => { handleEditMessage(message.id, editContent); setEditingId(null) }} className="text-xs text-green-400 hover:text-green-300 shrink-0">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-300 shrink-0">✕</button>
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
                    className="text-xs sm:text-sm text-gray-400 hover:text-gray-200 p-1"
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
          <div className="flex gap-3 text-gray-400 text-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
            <span>{t('messages.typing')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-700 p-3 md:p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('messages.placeholder')}
            className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {t('messages.send')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DirectMessagesPage;
