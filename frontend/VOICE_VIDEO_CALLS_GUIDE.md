# Voice/Video Calls Integration Guide

Comprehensive guide for implementing voice and video calling features in the 456 frontend application using WebRTC and the useVoiceVideoCall hook.

## Overview

The voice/video calling system provides:
- **Real-time voice calls** with audio streaming
- **Video calls** with HD video support
- **Incoming call notifications** with accept/decline options
- **Call control features** (mute, video toggle, end call)
- **Multi-user support** with remote participant management
- **Call duration tracking** and connection status monitoring

## Components

### 1. useVoiceVideoCall Hook

**Location**: `src/components/useVoiceVideoCall.ts`

**Purpose**: Manages WebRTC connections and media stream handling

**Key Features**:
- WebRTC peer connection management
- Local and remote media stream handling
- Audio/video track control
- Call state management
- Multi-participant support
- Automatic resource cleanup

**Usage**:
```typescript
import useVoiceVideoCall from '@/components/useVoiceVideoCall';

const MyCallComponent = () => {
  const callHook = useVoiceVideoCall();
  
  const startVideoCall = async () => {
    await callHook.initCall('video', 'target-user-id');
  };
  
  const toggleAudio = async () => {
    await callHook.toggleAudio();
  };
  
  return (
    <div>
      <button onClick={startVideoCall}>Start Video Call</button>
      <button onClick={toggleAudio}>
        {callHook.isAudioEnabled ? 'Mute' : 'Unmute'}
      </button>
    </div>
  );
};
```

### 2. VideoCall Component

**Location**: `src/components/VideoCall.tsx`

**Purpose**: Full-featured video conferencing interface

**Features**:
- Dual video windows (local and remote)
- Picture-in-picture mode
- Audio/video toggle buttons
- Call duration display
- Minimize/maximize functionality
- Connection status indicator
- End call button

**Usage**:
```typescript
import VideoCall from '@/components/VideoCall';

export default function VideoCallPage() {
  return (
    <VideoCall
      localParticipantName="John Doe"
      remoteParticipantName="Jane Smith"
      remoteParticipantAvatar="https://..."
      onEndCall={() => console.log('Call ended')}
      onToggleAudio={() => console.log('Audio toggled')}
      onToggleVideo={() => console.log('Video toggled')}
    />
  );
}
```

### 3. CallNotification Component

**Location**: `src/components/CallNotification.tsx`

**Purpose**: Incoming call alert and acceptance interface

**Features**:
- Full-screen modal notification
- Caller name and avatar display
- Call type indicator (voice/video)
- Animated ring effect
- Accept/Decline buttons
- Auto-dismissible

**Usage**:
```typescript
import CallNotification from '@/components/CallNotification';

const [incomingCall, setIncomingCall] = useState(null);

return (
  <CallNotification
    callerName="Alice Johnson"
    callerAvatar="https://..."
    callType="video"
    isVisible={!!incomingCall}
    onAccept={() => {
      setIncomingCall(null);
      // Handle acceptance
    }}
    onReject={() => {
      setIncomingCall(null);
      // Handle rejection
    }}
  />
);
```

## WebRTC Setup

### Browser Support

The following browsers are supported:
- Chrome 50+
- Firefox 55+
- Safari 11+
- Edge 79+

### STUN/TURN Servers

For production, configure STUN/TURN servers in the hook:

```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com',
    username: 'username',
    credential: 'password'
  }
];
```

## Integration Steps

### 1. Backend WebSocket Setup

Ensure your backend implements:
- WebSocket endpoint for call signaling
- Message types: `call-initiate`, `call-accept`, `call-reject`, `call-end`
- ICE candidate exchange
- SDP offer/answer negotiation

### 2. Media Permissions

Request browser permissions:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
});
```

### 3. Connection Lifecycle

1. **Initiate Call**: Get user media and send call initiation signal
2. **Wait for Answer**: Receive SDP answer from peer
3. **Exchange ICE Candidates**: Establish media connection
4. **Stream Exchange**: Attach remote streams to video elements
5. **Call Active**: Monitor connection and participant streams
6. **End Call**: Stop all tracks and close peer connection

## Usage Example

```typescript
'use client';

import React, { useState } from 'react';
import VideoCall from '@/components/VideoCall';
import CallNotification from '@/components/CallNotification';
import useVoiceVideoCall from '@/components/useVoiceVideoCall';

export default function ChatPage() {
  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const call = useVoiceVideoCall();

  const handleStartCall = async () => {
    await call.initCall('video', 'peer-user-id');
    setCallActive(true);
  };

  const handleAcceptCall = async () => {
    await call.acceptCall();
    setCallActive(true);
    setIncomingCall(false);
  };

  const handleEndCall = () => {
    call.endCall();
    setCallActive(false);
  };

  return (
    <div className="w-full h-screen">
      <CallNotification
        callerName="John Doe"
        callType="video"
        isVisible={incomingCall}
        onAccept={handleAcceptCall}
        onReject={() => setIncomingCall(false)}
      />

      {callActive ? (
        <VideoCall
          localParticipantName="You"
          remoteParticipantName="John Doe"
          onEndCall={handleEndCall}
        />
      ) : (
        <button
          onClick={handleStartCall}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Start Video Call
        </button>
      )}
    </div>
  );
}
```

## Error Handling

```typescript
if (call.error) {
  console.error('Call error:', call.error);
  // Handle error appropriately
}
```

## Performance Optimization

1. **Bitrate Control**: Limit video bitrate for lower bandwidth
   ```typescript
   const videoConstraints = {
     width: 640,
     height: 480,
     frameRate: 24
   };
   ```

2. **Media Quality**: Adjust quality based on network

3. **Connection Monitoring**: Check connection state regularly

4. **Resource Cleanup**: Always close connections on unmount

## Security Considerations

1. **HTTPS Only**: WebRTC requires secure context
2. **Permission Handling**: Request minimal necessary permissions
3. **Data Validation**: Validate all signaling messages
4. **DTLS/SRTP**: Ensure encrypted media streams

## Testing

### Unit Tests
```bash
npm test -- useVoiceVideoCall.test.ts
npm test -- VideoCall.test.tsx
npm test -- CallNotification.test.tsx
```

### Integration Testing
1. Open two browser windows
2. Initiate call from window 1
3. Accept call in window 2
4. Verify audio/video streams
5. Test toggle controls
6. End call and verify cleanup

## Troubleshooting

### No Audio/Video
- Check browser permissions
- Verify media device availability
- Test with different devices
- Check browser console for errors

### Connection Failed
- Verify WebSocket connectivity
- Check STUN/TURN server configuration
- Verify firewall settings
- Check network bandwidth

### High Latency
- Reduce video quality
- Check network bandwidth
- Use closer TURN server
- Monitor CPU usage

## Future Enhancements

- Screen sharing support
- Recording functionality
- Call history logging
- Conference calls (3+ participants)
- Advanced bitrate adaptation
- Network statistics dashboard
- Call quality analytics
