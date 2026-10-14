import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useStore } from "../lib/store";
import { messagesAPI, uploadAPI } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { CallCard, VoiceMessagePlayer } from "../components/MessageList";
import { showToast } from "../components/Toast";
import { useLanguage } from "../contexts/LanguageContext";
import { useNotifications } from "../contexts/NotificationContext";
import { ArrowLeft, Phone, Video, MessageSquare, Mic, Send, X } from "lucide-react";

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  type?: string; // "text" | "voice" | "call"
  voice_url?: string;
  voice_duration?: number;
  created_at: string;
  updated_at?: string;
}

interface Message {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  content: string;
  type?: string;
  message_type?: string;
  voice_url?: string;
  voice_duration?: number;
  created_at: string;
}

const DirectMessagesPage: React.FC = () => {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user: currentUser } = useStore();
  const { t } = useLanguage();
  const { initiateCall } = useNotifications();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  // Голосовые сообщения
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Длительность в ref: onstop у MediaRecorder — замыкание, state там устаревает
  const recordingTimeRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!userId || !currentUser?.id) return;

    let cancelled = false;
    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await messagesAPI.getMessages(userId, 50, 0);
        if (cancelled) return;
        if (Array.isArray(response)) {
          // API отдаёт DESC (новые первыми) — разворачиваем, новые внизу
          setMessages((response as DirectMessage[]).slice().reverse());
        }
        // Помечаем входящие прочитанными (сброс бейджа непрочитанных)
        messagesAPI.markConversationRead(userId).catch(() => {});
      } catch (error) {
        if (!cancelled) console.error("Failed to load messages:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Звонок собеседнику из шапки диалога. Режим (аудио/видео) передаётся
  // на страницу звонка через sessionStorage — VideoCallPage читает outgoingCallMode.
  const startDmCall = (mode: "audio" | "video") => {
    if (!userId) return;
    sessionStorage.setItem("outgoingCallMode", mode);
    initiateCall(userId, `User ${userId}`);
  };

  // Дедуплицирующее добавление сообщения (локальная отправка и WS-эхо системных
  // сообщений могут прийти одновременно)
  const appendMessage = (msg: DirectMessage) => {
    setMessages((prev) =>
      prev.some((m) => String(m.id) === String(msg.id)) ? prev : [...prev, msg],
    );
  };

  useEffect(() => {
    if (!currentUser?.id || !userId) return;

    let closedByUs = false;
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
              appendMessage({
                ...msg,
                sender_id: msg.sender_id || '',
                receiver_id: msg.receiver_id || '',
              } as DirectMessage);
            } else if (data.type === "direct_message") {
              // Событие бэкенда о новом личном сообщении (в т.ч. системные
              // карточки звонков — они рассылаются обоим участникам)
              const fromId = String(data.fromUserId || data.from_user_id || "");
              const toId = String(data.toUserId || data.to_user_id || "");
              const mine = String(currentUser.id);
              const inThisChat =
                (fromId === String(userId) && toId === mine) ||
                (fromId === mine && toId === String(userId));
              if (!inThisChat) return;
              appendMessage({
                id: String(data.id),
                sender_id: fromId,
                receiver_id: toId,
                content: data.content || "",
                read: true,
                type: data.message_type || "text",
                voice_url: data.voice_url,
                voice_duration: data.voice_duration,
                created_at: data.created_at || data.createdAt || new Date().toISOString(),
              });
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
          if (!closedByUs) setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
      }
    };

    connectWebSocket();

    return () => {
      closedByUs = true;
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
      appendMessage(message as DirectMessage);
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

  // --- Голосовые сообщения (MediaRecorder → upload → message type=voice) ---

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    // getUserMedia доступен только в secure context (HTTPS/localhost)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast({
        type: "warning",
        title: "Запись голосовых требует HTTPS",
        message: "Откройте сайт по защищённому соединению (https://)",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];
        if (discardRecordingRef.current) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        const durationSec = recordingTimeRef.current;
        setSendingVoice(true);
        try {
          const ext = blob.type.includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
          const uploaded = await uploadAPI.uploadFile(file, "audio");
          const message = await messagesAPI.sendMessage(userId!, "", {
            voiceUrl: uploaded.url,
            voiceDuration: durationSec,
          });
          appendMessage(message as DirectMessage);
        } catch (error) {
          console.error("Failed to send voice message:", error);
          showToast({ type: "error", title: "Не удалось отправить голосовое" });
        } finally {
          setSendingVoice(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      showToast({
        type: "error",
        title: "Нет доступа к микрофону",
        message: "Разрешите доступ к микрофону в настройках браузера",
      });
    }
  };

  const stopRecording = (send: boolean) => {
    discardRecordingRef.current = !send;
    stopRecordingTimer();
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  };

  // Остановка записи при уходе со страницы
  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      stopRecordingTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatRecordingTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

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
          <button
            onClick={() => startDmCall("audio")}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Аудиозвонок"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => startDmCall("video")}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Видеозвонок"
          >
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
                {message.type === "call" ? (
                  <CallCard content={message.content} />
                ) : message.type === "voice" && message.voice_url ? (
                  <VoiceMessagePlayer url={message.voice_url} duration={message.voice_duration} />
                ) : editingId === message.id ? (
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
              {message.sender_id === currentUser?.id && (!message.type || message.type === "text") && (
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
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-sm font-medium text-red-400 tabular-nums">
                {formatRecordingTime(recordingTime)}
              </span>
              <span className="text-xs text-muted-foreground truncate">Идёт запись голосового…</span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Отменить запись"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              disabled={sendingVoice || recordingTime < 1}
              className="p-2.5 rounded-xl bg-gradient-brand text-primary-foreground shadow-soft hover:shadow-glow disabled:opacity-50 transition-all"
              title="Отправить голосовое"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startRecording}
              disabled={sendingVoice}
              className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="Записать голосовое сообщение"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={sendingVoice ? "Отправка голосового…" : t('messages.placeholder')}
              disabled={sendingVoice}
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sendingVoice}
              className="bg-gradient-brand text-primary-foreground px-6 py-2 rounded-xl font-medium shadow-soft hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {t('messages.send')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default DirectMessagesPage;
