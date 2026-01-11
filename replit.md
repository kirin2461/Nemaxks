# Nemaks - Modern Communication Platform

## Overview

Nemaks is a modern, real-time communication platform designed to offer Discord-style features, including real-time messaging, channels, stories, and an AI assistant. The platform aims to provide a comprehensive communication experience with robust admin tools, multimedia support, and extensive customization options. Its key capabilities include real-time interactions via WebSockets, a 5-star post rating system, multi-language support (Russian and English), and a sophisticated admin panel for user and content management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18.3 and TypeScript 5.6, using Vite 6 for tooling. State management is handled by Zustand for global state and React Query for server state caching. Styling leverages Tailwind CSS 3 with a custom design system and Framer Motion for animations. The project structure is modular, separating reusable components, pages, core utilities, and styles. Key components include dynamic Stories, interactive StarRating, real-time TypingIndicators, and a comprehensive AdminPanel. Mobile responsiveness is a core design principle, implemented with a mobile header, bottom navigation bar, and responsive layouts across all pages.

### Backend

The backend is developed in Go using the Gin framework, providing a RESTful API with JWT-based authentication. PostgreSQL is used as the database, managed with the GORM ORM. The architecture supports core features like user management, guild/channel systems, real-time messaging, stories with 24-hour expiration, and a 5-star rating system. It includes robust content filtering with forbidden words and regex support, IP banning, abuse reporting, and audit logging. WebSocket integration enables real-time functionalities.

### Data Flow

Authentication uses JWT tokens. User sessions and UI preferences are managed via a Zustand store. API calls are centralized and typed. Real-time updates are handled via WebSocket. The platform supports internationalization with Russian and English translations.

### Key Features and Implementations

- **Real-time Communication:** WebSocket support for messaging, typing indicators, and online status.
- **Content Management:** 24-hour disappearing Stories, 5-star post ratings, post bookmarks, likes, and subscriptions.
- **User Interaction:** Message reactions, reply quoting, message forwarding, pinned messages, audio/video uploads, and an AI assistant (Jarvis).
- **Voice/Video Calls:** WebRTC-based voice and video channels with multi-party support, screen sharing, noise suppression, and incoming call notifications.
- **Admin Tools:** Full admin panel with user management, IP bans, abuse reports, audit logs, and content filtering.
- **Theming & UI:** Multiple theme options with dynamic, animated backgrounds and a responsive design optimized for mobile.
- **Security:** IP banning, content filtering, and QR code login for secure cross-device authentication.
- **Internationalization:** Multi-language support (Russian and English).
- **Advanced Messaging:** Voice messages, message editing, and search functionality.

## External Dependencies

### Frontend Runtime

- **react / react-dom**: UI framework.
- **wouter**: Lightweight client-side routing.
- **zustand**: Global state management.
- **@tanstack/react-query**: Server state caching.
- **socket.io-client**: WebSocket client.
- **framer-motion**: UI animations.
- **lucide-react**: Icon library.
- **date-fns**: Date manipulation utilities.
- **zod**: Schema validation.
- **react-hook-form / @hookform/resolvers**: Form management.

### Backend

- **gin**: HTTP web framework.
- **gorm**: ORM for PostgreSQL.
- **jwt-go**: JWT authentication.

### Development

- **vite**: Build tool and dev server.
- **typescript**: Type checking.
- **tailwindcss / postcss / autoprefixer**: CSS processing.
- **eslint**: Code linting.

## Recent Changes (January 2026)

- **Service Restoration (Latest)**
  - Fixed Rust toolchain memory issues by clearing `LD_PRELOAD` and `LD_LIBRARY_PATH` in service workflows.
  - Installed missing frontend dependencies (Vite) and configured Rust default toolchain.
  - Verified Go backend and React frontend are running correctly.

- **Security Audit & Fixes**
  - Password hashing with bcrypt for registration and login (previously plaintext)
  - Auto-migration of legacy passwords on login (detects bcrypt hash by $2 prefix, covers $2a$/$2b$/$2y$/$2x$ variants)
  - WebSocket origin validation with URL parsing (validates hostname suffix against .replit.dev, .repl.co, .replit.app, localhost)
  - JWT signing method validation in authMiddleware (HMAC only)
  - RBAC verified for admin routes (admin/moderator roles required)
  - Database indexes added for messages and friend requests
  - Improved DB error handling in friend request handlers

- **WebSocket Security Hardening**
  - WebSocket connections now require JWT token authentication
  - Token signing method validation prevents unsigned token attacks
  - All frontend WebSocket connections updated to send JWT via query parameter
  
- **Friends Page Fixes**
  - Backend returns request_id for friend requests
  - Frontend uses request_id for accept/decline/cancel operations
  
- **Message History Ordering Fix**
  - Messages now returned in chronological order (ASC) for proper display in chat
  
- **Audio Upload Support**
  - Backend detects WAV, OGG, MP3 audio files via magic bytes
  - Client type hint distinguishes audio WebM from video WebM
  
- **Enhanced Reply System**
  - Backend preloads ReplyTo relationship in message queries
  - Frontend displays quoted message content with author name

- **Call System Overhaul**
  - Unique call IDs (UUID) prevent stale call events from affecting new calls
  - OutgoingCallModal component shows dialing status with cancel option
  - Call states: dialing, ringing, connected, rejected, ended
  - Backend routes call-accepted and call-cancelled WebSocket messages
  - IncomingCall and OutgoingCall state managed in NotificationContext
  - FriendsPage initiateCall uses NotificationContext for proper call flow
  - Rejected calls show status for 2 seconds before dismissing modal
  - Call cancellation clears incoming call modal on recipient side

- **Real-time Channel Messaging**
  - NotificationContext provides subscribeToMessages hook for WebSocket event handling
  - ChannelsPage subscribes to 'channel-message' events via WebSocket
  - Messages load from API when channel is selected (loadChannelMessages)
  - New messages sent via channelsAPI.sendMessage (POST /channels/:id/messages)
  - Backend broadcasts channel messages to all connected clients
  - Real-time message updates appear instantly for all users in the channel

- **Voice Channel Speaking Indicator (Updated)**
  - Real-time audio level detection for remote users via Web Audio API AnalyserNode
  - Green border/ring appears around user avatar when speaking
  - Border reverts when audio stream stops or level drops below threshold
  - Uses frequency analysis with smoothing and hold time for natural transitions
  - VoiceContext provides setRemoteSpeaking, syncConnectedUsers, addConnectedUser, removeConnectedUser
  - VoiceChannel syncs roster updates with VoiceContext on voice-users/voice-user-joined/voice-user-left events
  - Speaking indicators driven by actual audio flow analysis, not just WebSocket events
  - Consolidated user list management through VoiceContext for consistent state across components

- **WebRTC Voice Chat System (Updated)**
  - Complete mesh network topology for peer-to-peer audio streaming
  - VoiceContext manages RTCPeerConnection lifecycle per user
  - Dynamic ICE server configuration via /api/rtc/ice-servers endpoint
  - STUN + TURN servers for reliable NAT traversal (uses metered.ca free TURN or custom via env vars)
  - VoiceContext exposes getICEServers() for shared ICE configuration across components
  - VoiceChannel uses shared ICE servers from VoiceContext
  - Signaling via existing WebSocket (voice-offer, voice-answer, voice-ice-candidate)
  - Backend voice roster tracking with GET /api/voice/channels/:id/participants
  - Automatic roster cleanup on WebSocket disconnect
  - ICE candidate buffering for pending connections
  - Speaking detection via Web Audio API AnalyserNode
  - Per-user volume controls (0-200%) with setUserVolume function
  - Automatic ICE restart on connection failure (3s timeout for disconnected, immediate for failed)
  - Automatic peer reconnection on connection failure
  - Discord-style VoiceStatusBar with user list, speaking indicators, and controls
  - No dial tones when entering voice channels (separated from direct calls)
  - Environment variables for custom TURN: TURN_SERVER_URL, TURN_SERVER_USERNAME, TURN_SERVER_PASSWORD

- **Channel Management & UI Improvements (Latest)**
  - ConfirmDialog component for user confirmations (replaces native browser dialogs)
  - Channel deletion only available to guild owners (owner_id gating)
  - Delete channel context menu option shows ConfirmDialog with warning
  - Leave channel/guild confirmations via ConfirmDialog
  - Message deletion confirmation via ConfirmDialog
  - Vite build optimizations: manual chunks for vendor dependencies, CSS minification, optimized dependency pre-bundling
  - Improved loading screen with animated spinner