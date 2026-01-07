# Real-time Collaborative Editing Guide

## Overview

The real-time collaborative editing feature enables multiple users to simultaneously edit channel tools (boards and notebooks) with live synchronization via WebSocket connections.

## Architecture

### Core Components

#### 1. Session Management (`handlers_tool_realtime_collaboration.go`)

- **CollaborativeSession**: Manages connections for each tool
  - Maintains list of connected users
  - Handles message broadcasting
  - Manages cursor position tracking

- **UserConnection**: Represents individual user connection
  - User ID and username
  - Message channel (100-buffer)
  - Last seen timestamp

#### 2. Protocol Messages

- **ToolSyncMessage**: Main message structure
  - Type: 'sync_state', 'update', or 'cursor'
  - ToolID: Which tool is being edited
  - Update: Specific edit operation (optional)
  - Cursor: Cursor position data (optional)

- **ToolUpdate**: Represents a single edit
  - Type: 'element_added', 'element_updated', 'element_removed'
  - UserID and Username: Who made the change
  - ElementID: What was changed
  - Data: The actual content
  - Timestamp: When it happened

- **CursorPos**: Cursor tracking
  - UserID, Username
  - X, Y coordinates
  - Color: For visual distinction

#### 3. HTTP Routes

```
GET  /ws/collab/:channel_id/:tool_id
  WebSocket upgrade endpoint for real-time editing
  
POST /api/collab/sync
  Synchronize updates via HTTP (for offline-capable clients)
  
GET  /api/collab/users/:channel_id/:tool_id
  Get list of currently connected users
  
POST /api/collab/cursor
  Broadcast cursor position updates
```

#### 4. Handler Functions

**handleRealtimeCollaboration**
- WebSocket upgrade handler
- Manages connection lifecycle
- Broadcasts updates to all connected users

**handleCollaborationSync**
- HTTP POST endpoint for sync updates
- Processes ToolUpdate messages
- Saves snapshots for version history

**handleGetCollaborationUsers**
- GET endpoint
- Returns list of active users and last seen timestamps

**handleUpdateCursorPosition**
- POST endpoint
- Broadcasts cursor positions (excludes sender)

## Workflow

### Connecting

1. Client initiates WebSocket upgrade to `/ws/collab/:channel_id/:tool_id`
2. Server accepts connection and adds user to session
3. User joins broadcast group

### Editing

1. User makes edit in their local document
2. Client sends ToolUpdate via WebSocket
3. Server receives and broadcasts to all users in session
4. Each connected user receives and applies update
5. Optional: Save snapshot for version history

### Cursor Tracking

1. User moves cursor
2. Client sends CursorPos update
3. Server broadcasts to other users (excludes sender)
4. Other clients display remote cursors

### Disconnecting

1. WebSocket closes (network error, user leaves)
2. Server removes user from session
3. Broadcasts user disconnect to remaining users

## Data Flow

```
Client A                 Server                    Client B
  |                        |                          |
  |---Edit Update---------->|                          |
  |                         |--Broadcast Update------->|
  |                         |                          |
  |                    (Save to DB)              (Apply Update)
  |                         |                          |
  |                         |<-----Cursor Position-----|
  |                         |--Broadcast Cursor------>|
  |                    (Display Remote Cursor)        |
```

## Helper Functions

**GetCurrentTimestamp()**
- Returns current time in milliseconds
- Used for all event timestamps

**SaveToolSnapshot()**
- Saves state snapshot for version history
- Tracks who made what changes
- Currently returns nil (TODO: implement database saving)

## Session Management

### Global Sessions Map

```go
var Sessions = make(map[uint]*CollaborativeSession) // ToolID -> Session
```

### Session Lifecycle

1. First user connects → Session created (GetOrCreateSession)
2. User added to session (AddUser)
3. Updates broadcasted via BroadcastUpdate/BroadcastCursor
4. User disconnects → RemoveUser
5. Last user leaves → Session garbage collected (cleanup)

## Usage Examples

### WebSocket Connection (Frontend)

```javascript
const ws = new WebSocket(`ws://localhost:8000/ws/collab/${channelId}/${toolId}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'update') {
    applyUpdate(msg.update);
  } else if (msg.type === 'cursor') {
    showRemoteCursor(msg.cursor);
  }
};

function sendEdit(elementId, data) {
  const update = {
    type: 'update',
    tool_id: toolId,
    update: {
      type: 'element_updated',
      user_id: userId,
      username: username,
      element_id: elementId,
      data: data,
      timestamp: Date.now()
    }
  };
  ws.send(JSON.stringify(update));
}
```

### HTTP Sync (For Offline Support)

```bash
curl -X POST http://localhost:8000/api/collab/sync \
  -H "Content-Type: application/json" \
  -d '{
    "tool_id": 123,
    "update": {
      "type": "element_added",
      "user_id": 1,
      "username": "john",
      "element_id": "elem_456",
      "data": {...},
      "timestamp": 1673097600000
    }
  }'
```

### Get Active Users

```bash
curl http://localhost:8000/api/collab/users/5/10
```

Response:
```json
[
  {
    "user_id": 1,
    "username": "john",
    "last_seen": 1673097615000
  },
  {
    "user_id": 2,
    "username": "jane",
    "last_seen": 1673097610000
  }
]
```

## Performance Considerations

1. **Message Buffering**: Each connection has 100-message buffer
   - Prevents slow clients from blocking others
   - Drops oldest messages if buffer full

2. **Mutex Locking**: 
   - RWMutex for session access
   - Allows concurrent reads
   - Exclusive writes for updates

3. **Broadcast Overhead**:
   - O(n) where n = connected users
   - Optimized for typical 2-10 concurrent users
   - Consider horizontal scaling for 100+ users

## Future Enhancements

1. **Conflict Resolution**:
   - Implement Operational Transformation (OT)
   - OR use CRDT algorithms
   - Handle simultaneous edits

2. **Persistence**:
   - Implement SaveToolSnapshot database integration
   - Store edit history
   - Enable version comparison

3. **Offline Support**:
   - Queue updates locally
   - Sync when connection restored
   - Merge conflicts automatically

4. **Scalability**:
   - Redis pub/sub for multi-server deployments
   - Load balancing with sticky sessions
   - Horizontal scaling

5. **Security**:
   - Rate limiting on updates
   - Permission validation per user/channel
   - Audit logging for changes

## Troubleshooting

### WebSocket Connection Fails
- Check WebSocket endpoint URL
- Verify server is running
- Check CORS configuration
- Ensure authentication token is valid

### Updates Not Syncing
- Verify message format matches protocol
- Check that tool_id is correct
- Look for errors in server logs
- Confirm user is in session

### Missing Users in Active List
- Wait a few seconds (updates are async)
- Refresh the user list
- Check that WebSocket is still connected

## Status

✅ **Completed**:
- WebSocket routes in main.go
- HTTP handler functions
- Session management
- Message broadcasting
- Cursor tracking

⏳ **In Progress**:
- Frontend UI integration
- End-to-end testing

📋 **TODO**:
- Database persistence for snapshots
- Conflict resolution algorithm
- Offline support
- Rate limiting
- Multi-server sync (Redis)
