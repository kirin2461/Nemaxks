'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Users } from 'lucide-react';

interface RemoteUser {
  userId: string;
  username: string;
  cursorPosition: number;
  color: string;
}

interface CollaborativeEditorProps {
  documentId: string;
  userId: string;
  username: string;
  serverUrl: string;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
}

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  userId,
  username,
  serverUrl,
  onContentChange,
  onSave,
}) => {
  const [content, setContent] = useState<string>('');
  const [remoteUsers, setRemoteUsers] = useState<Map<string, RemoteUser>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const userColorRef = useRef(colors[Math.floor(Math.random() * colors.length)]);

  // WebSocket connection for real-time collaboration
  useEffect(() => {
    const wsProtocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${serverUrl.replace(/^https?:\/\//, '')}/api/realtime/ws/${documentId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'sync',
        userId,
        username,
        documentId,
        version,
        content,
        timestamp: Date.now(),
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [documentId, userId, username, serverUrl, version, content]);

  const handleMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case 'edit':
          if (message.userId !== userId && message.changes) {
            applyRemoteChanges(message.changes);
          }
          break;
        case 'cursor':
          if (message.userId !== userId) {
            setRemoteUsers((prev) => {
              const updated = new Map(prev);
              updated.set(message.userId, {
                userId: message.userId,
                username: message.username || 'Unknown',
                cursorPosition: message.cursorPosition || 0,
                color: message.color || '#999',
              });
              return updated;
            });
          }
          break;
        case 'user_joined':
          if (message.userId !== userId) {
            setRemoteUsers((prev) => {
              const updated = new Map(prev);
              updated.set(message.userId, {
                userId: message.userId,
                username: message.username || 'Unknown',
                cursorPosition: 0,
                color: message.color || '#999',
              });
              return updated;
            });
          }
          break;
        case 'user_left':
          setRemoteUsers((prev) => {
            const updated = new Map(prev);
            updated.delete(message.userId);
            return updated;
          });
          break;
      }
    },
    [userId]
  );

  const applyRemoteChanges = (changes: Array<{ offset: number; deleted: number; inserted: string }>) => {
    let newContent = content;
    const sortedChanges = [...changes].sort((a, b) => b.offset - a.offset);

    for (const change of sortedChanges) {
      newContent =
        newContent.substring(0, change.offset) +
        change.inserted +
        newContent.substring(change.offset + change.deleted);
    }

    setContent(newContent);
    onContentChange?.(newContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onContentChange?.(newContent);
    setVersion((v) => v + 1);
  };

  const handleCursorMove = useCallback(() => {
    if (editorRef.current && isConnected) {
      const position = editorRef.current.selectionStart;
      // Cursor position would be sent via WebSocket in real implementation
      console.log('Cursor at position:', position);
    }
  }, [isConnected]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave?.(content);
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  return (
    <div className="collaborative-editor w-full h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">{username}'s Document</h2>
          <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-600">{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRemoteUsers(new Map())}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded transition"
          >
            <Users size={16} />
            {remoteUsers.size} online
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isConnected}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 disabled:bg-gray-400 transition"
          >
            <Send size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Remote Users Cursors */}
      {remoteUsers.size > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-2 flex-wrap">
            {Array.from(remoteUsers.values()).map((user) => (
              <div key={user.userId} className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-gray-200">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                <span className="text-xs text-gray-700">{user.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 p-4 overflow-hidden">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          onMouseMove={handleCursorMove}
          onKeyUp={handleCursorMove}
          placeholder="Start typing... Your changes will sync in real-time."
          className="w-full h-full p-4 font-mono text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <div>Characters: {content.length}</div>
        <div>Version: {version}</div>
        <div>Last saved: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
};

export default CollaborativeEditor;
