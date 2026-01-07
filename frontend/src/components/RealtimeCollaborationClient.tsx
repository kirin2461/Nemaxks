'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface CollaborationMessage {
  type: 'edit' | 'cursor' | 'selection' | 'undo' | 'redo' | 'sync';
  userId: string;
  documentId: string;
  version: number;
  content?: string;
  position?: number;
  changes?: Array<{ offset: number; deleted: number; inserted: string }>;
  cursorPosition?: number;
  selection?: { start: number; end: number };
  timestamp: number;
}

interface RealtimeCollaborationClientProps {
  documentId: string;
  userId: string;
  serverUrl: string;
  onContentChange?: (content: string) => void;
  onCursorMove?: (userId: string, position: number) => void;
}

const RealtimeCollaborationClient = ({
  documentId,
  userId,
  serverUrl,
  onContentChange,
  onCursorMove,
}: RealtimeCollaborationClientProps) => {
  const [content, setContent] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const [activeCursors, setActiveCursors] = useState<Map<string, number>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef<string>('');
  const versionRef = useRef<number>(0);

  // Connect to WebSocket server
  useEffect(() => {
    const wsProtocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${serverUrl.replace(/^https?:\/\//, '')}/api/realtime/ws/${documentId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // Send initial join message
      const joinMsg: CollaborationMessage = {
        type: 'sync',
        userId,
        documentId,
        version: versionRef.current,
        content: contentRef.current,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        handleCollaborationMessage(message);
      } catch (error) {
        console.error('Failed to parse collaboration message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
      }, 3000);
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [documentId, userId, serverUrl]);

  // Handle incoming collaboration messages
  const handleCollaborationMessage = useCallback(
    (message: CollaborationMessage) => {
      switch (message.type) {
        case 'edit':
          if (message.userId !== userId && message.changes) {
            applyRemoteChanges(message.changes, message.version);
          }
          break;
        case 'cursor':
          if (message.userId !== userId && message.cursorPosition !== undefined) {
            setActiveCursors((prev) => {
              const updated = new Map(prev);
              updated.set(message.userId, message.cursorPosition!);
              return updated;
            });
            onCursorMove?.(message.userId, message.cursorPosition);
          }
          break;
        case 'selection':
          // Handle remote selection if needed
          break;
        case 'sync':
          if (message.content && message.version > versionRef.current) {
            contentRef.current = message.content;
            versionRef.current = message.version;
            setContent(message.content);
            setVersion(message.version);
          }
          break;
      }
    },
    [userId, onCursorMove]
  );

  // Apply remote changes to local content
  const applyRemoteChanges = (
    changes: Array<{ offset: number; deleted: number; inserted: string }>,
    newVersion: number
  ) => {
    let updatedContent = contentRef.current;
    // Sort changes in reverse order to maintain correct positions
    const sortedChanges = [...changes].sort((a, b) => b.offset - a.offset);

    for (const change of sortedChanges) {
      updatedContent =
        updatedContent.substring(0, change.offset) +
        change.inserted +
        updatedContent.substring(change.offset + change.deleted);
    }

    contentRef.current = updatedContent;
    versionRef.current = newVersion;
    setContent(updatedContent);
    setVersion(newVersion);
    onContentChange?.(updatedContent);
  };

  // Handle local content changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      const oldContent = contentRef.current;
      contentRef.current = newContent;
      setContent(newContent);

      // Calculate changes
      const changes = calculateChanges(oldContent, newContent);
      versionRef.current += 1;
      setVersion(versionRef.current);

      // Send edit message
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const editMsg: CollaborationMessage = {
          type: 'edit',
          userId,
          documentId,
          version: versionRef.current,
          changes,
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(editMsg));
      }

      onContentChange?.(newContent);
    },
    [userId, documentId, onContentChange]
  );

  // Calculate changes between old and new content
  const calculateChanges = (
    oldContent: string,
    newContent: string
  ): Array<{ offset: number; deleted: number; inserted: string }> => {
    const changes: Array<{ offset: number; deleted: number; inserted: string }> = [];

    let i = 0;
    while (i < Math.min(oldContent.length, newContent.length) && oldContent[i] === newContent[i]) {
      i++;
    }

    if (i === oldContent.length && i === newContent.length) {
      return changes; // No changes
    }

    let j = 0;
    while (
      j < Math.min(oldContent.length - i, newContent.length - i) &&
      oldContent[oldContent.length - 1 - j] === newContent[newContent.length - 1 - j]
    ) {
      j++;
    }

    const deleted = oldContent.length - i - j;
    const inserted = newContent.substring(i, newContent.length - j);

    if (deleted > 0 || inserted.length > 0) {
      changes.push({ offset: i, deleted, inserted });
    }

    return changes;
  };

  // Send cursor position
  const sendCursorPosition = useCallback(
    (position: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const cursorMsg: CollaborationMessage = {
          type: 'cursor',
          userId,
          documentId,
          version: versionRef.current,
          cursorPosition: position,
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(cursorMsg));
      }
    },
    [userId, documentId]
  );

  return {
    content,
    isConnected,
    version,
    activeCursors,
    handleContentChange,
    sendCursorPosition,
  };
};

export default RealtimeCollaborationClient;
