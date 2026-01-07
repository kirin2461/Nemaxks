# Frontend Real-time Collaboration Integration Guide

This document describes how to integrate the real-time collaboration components in the 456 frontend application.

## Overview

The frontend provides three main components for real-time collaboration:

1. **RealtimeCollaborationClient** - Low-level WebSocket client for managing document synchronization
2. **ChannelTools** - UI component for displaying and managing boards/notebooks with hierarchy support
3. **CollaborativeEditor** - Full-featured editor component with real-time sync and multi-user awareness

## Components

### 1. RealtimeCollaborationClient

Manages WebSocket connections and document synchronization using operational transformation.

**Location**: `src/components/RealtimeCollaborationClient.tsx`

**Features**:
- WebSocket connection management
- Operational transformation for conflict-free edits
- Cursor position tracking
- Version control and document state management
- Automatic reconnection handling

**Usage**:
```typescript
import RealtimeCollaborationClient from '@/components/RealtimeCollaborationClient';

const client = RealtimeCollaborationClient({
  documentId: 'doc-123',
  userId: 'user-456',
  serverUrl: 'https://api.example.com',
  onContentChange: (content) => console.log('Content updated:', content),
  onCursorMove: (userId, position) => console.log(`User ${userId} cursor at ${position}`),
});

// Get current state
const { content, isConnected, version, activeCursors } = client;

// Send local changes
client.handleContentChange(newContent);

// Send cursor position
client.sendCursorPosition(currentPosition);
```

### 2. ChannelTools

Displays boards and notebooks organized by type with role-based access control.

**Location**: `src/components/ChannelTools.tsx`

**Features**:
- Board and notebook management
- Expandable sections by tool type
- Role-based visibility (admin, moderator, member)
- Permission-based edit access
- Item selection and deletion
- Hierarchy support with user role checking

**Usage**:
```typescript
import ChannelTools, { ChannelToolItem } from '@/components/ChannelTools';

const items: ChannelToolItem[] = [
  {
    id: 'board-1',
    name: 'Project Board',
    type: 'board',
    description: 'Main project management board',
    ownerRole: 'admin',
    visibleTo: ['admin', 'moderator', 'member'],
    editableBy: ['admin', 'moderator'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

<ChannelTools
  channelId="channel-123"
  items={items}
  userRole="moderator"
  onCreateBoard={() => console.log('Create board')}
  onCreateNotebook={() => console.log('Create notebook')}
  onSelectItem={(item) => console.log('Selected:', item)}
  onDeleteItem={(itemId) => console.log('Delete:', itemId)}
  onUpdatePermissions={(itemId, visibleTo, editableBy) => console.log('Update permissions')}
/>
```

### 3. CollaborativeEditor

Full-featured text editor with real-time synchronization and multi-user collaboration.

**Location**: `src/components/CollaborativeEditor.tsx`

**Features**:
- Real-time text editing with WebSocket sync
- Multi-user cursor display with color coding
- Connection status indicator
- Character count and version tracking
- Save functionality with async support
- Remote user awareness
- Edit conflict resolution

**Usage**:
```typescript
import CollaborativeEditor from '@/components/CollaborativeEditor';

<CollaborativeEditor
  documentId="doc-123"
  userId="user-456"
  username="John Doe"
  serverUrl="https://api.example.com"
  onContentChange={(content) => console.log('Content:', content)}
  onSave={async (content) => {
    await saveDocumentToServer(content);
  }}
/>
```

## Integration Steps

### 1. Backend Setup

Ensure the backend is running with:
- WebSocket endpoint at `/api/realtime/ws/{documentId}`
- Support for message types: `edit`, `cursor`, `selection`, `undo`, `redo`, `sync`
- Document versioning and operational transformation

### 2. Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure WebSocket URL in your environment:
```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

3. Import and use components in your pages:
```typescript
import CollaborativeEditor from '@/components/CollaborativeEditor';
import ChannelTools from '@/components/ChannelTools';

export default function DocumentPage() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <aside className="col-span-1">
        <ChannelTools
          channelId="ch-123"
          items={channelItems}
          userRole={currentUserRole}
          onSelectItem={handleSelectTool}
        />
      </aside>
      <main className="col-span-3">
        <CollaborativeEditor
          documentId={selectedDocId}
          userId={userId}
          username={userName}
          serverUrl={apiUrl}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
```

## Message Protocol

All messages are sent via WebSocket as JSON objects:

### Edit Message
```json
{
  "type": "edit",
  "userId": "user-123",
  "documentId": "doc-456",
  "version": 42,
  "changes": [
    { "offset": 10, "deleted": 5, "inserted": "new text" }
  ],
  "timestamp": 1234567890
}
```

### Cursor Message
```json
{
  "type": "cursor",
  "userId": "user-123",
  "documentId": "doc-456",
  "version": 42,
  "cursorPosition": 150,
  "timestamp": 1234567890
}
```

### Sync Message
```json
{
  "type": "sync",
  "userId": "user-123",
  "documentId": "doc-456",
  "version": 42,
  "content": "full document content",
  "timestamp": 1234567890
}
```

## Performance Considerations

1. **Debouncing**: Consider debouncing cursor position updates to reduce message frequency
2. **Change Batching**: Group multiple rapid edits into single messages
3. **Lazy Loading**: Load channel tools on demand
4. **Memory Management**: Cleanup WebSocket connections on component unmount
5. **Version Management**: Archive old document versions periodically

## Troubleshooting

### WebSocket Connection Failed
- Verify backend is running and WebSocket endpoint is accessible
- Check CORS/WebSocket security settings
- Ensure serverUrl is correctly configured

### Changes Not Syncing
- Check WebSocket connection status via `isConnected` state
- Verify message format matches backend expectations
- Check browser console for error messages
- Ensure user has proper permissions for edit operations

### Cursor Tracking Issues
- Ensure cursor position updates are being sent at reasonable intervals
- Check that remote user color assignment is consistent
- Verify cursor position data is not exceeding document length

## Testing

Test collaboration by opening multiple browser windows/tabs and:
1. Making edits simultaneously in different windows
2. Verifying changes sync across all windows
3. Checking cursor positions update correctly
4. Testing with different user roles and permissions

## Future Enhancements

- Rich text editing support (Markdown, WYSIWYG)
- Inline comments and suggestions
- Document history and version browser
- Conflict resolution UI
- Offline editing with sync on reconnect
- Presence indicators and activity timeline
- Document sharing and permissions UI
- Real-time code syntax highlighting
- Collaborative drawing/diagramming
