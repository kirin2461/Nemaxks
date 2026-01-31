# Nemaks - Modern Communication Platform

## Overview

Nemaks is a modern, real-time communication platform designed to offer a comprehensive and engaging communication experience similar to Discord. It features real-time messaging, channels, ephemeral stories, and an integrated AI assistant. The platform emphasizes secure, responsive, and feature-rich user interaction, supported by robust admin tools, multimedia capabilities, and extensive customization. Key capabilities include real-time interactions via WebSockets, a 5-star post rating system, multi-language support (Russian and English), and an advanced admin panel for managing users and content. The project aims to integrate various communication modalities, from text to video calls, with a focus on community building and content moderation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX and Frontend

The frontend is built with React 18.3, TypeScript 5.6, and Vite 6. It utilizes Zustand for global state management and React Query for server-side data caching. Styling is handled by Tailwind CSS 3 with a custom design system, and animations are powered by Framer Motion. The design emphasizes modularity, mobile responsiveness, and multiple theme options with dynamic backgrounds. Key components include dynamic Stories, interactive StarRating, real-time TypingIndicators, and a comprehensive AdminPanel. A Discord-style channels page features a server sidebar, collapsible channel categories with type-specific icons, unread indicators, and real-time message actions like inline editing, deletion, and reactions. Welcome and landing pages feature animated backgrounds, feature grids, statistics, and clear calls to action.

### Backend and Core Functionality

The backend is developed in Go using the Gin framework, providing a RESTful API secured with JWT-based authentication. PostgreSQL, managed by GORM, serves as the database. The architecture supports user and guild/channel management, real-time messaging, 24-hour expiring stories, and a 5-star rating system. Robust content filtering, IP banning, abuse reporting, and audit logging are implemented. WebSocket integration facilitates real-time features such as messaging, typing indicators, and online status. Security includes bcrypt for password hashing and JWT validation. WebRTC is used for voice and video calls with a mesh network topology and STUN/TURN server support.

### Security Features (Phase 10)

- **TOTP Two-Factor Authentication (2FA)**: Users can enable 2FA using authenticator apps (Google Authenticator, Authy). Setup generates QR code and 8 recovery codes stored as bcrypt hashes. Login flow checks 2FA status before issuing tokens.
- **JWT Refresh Token Rotation**: Access tokens expire in 15 minutes, refresh tokens in 7 days. Tokens are rotated on each refresh to prevent token reuse attacks.
- **Session Management**: User sessions tracked with device info, IP address, and last activity. Users can view active sessions and revoke individual or all sessions.
- **Token Blacklist**: Revoked tokens are tracked in Redis (with memory fallback) for immediate invalidation. Automatic cleanup of expired blacklist entries.
- **Account Lockout**: 5 failed login attempts trigger a 15-minute lockout to prevent brute force attacks.
- **Security Headers**: CSP, X-Frame-Options, HSTS, X-Content-Type-Options applied globally.
- **HTML Sanitization**: All user-generated content (messages, posts, stories) sanitized to prevent XSS.

### End-to-End Encryption (Phase 11)

- **DM Encryption**: Direct messages use E2E encryption (X25519-XSalsa20-Poly1305). Keys are generated client-side and only the encrypted private key is stored on server.
- **Group Channel E2E**: Optional per-channel. Guild owners can enable E2E and distribute group keys encrypted to each member's public key.
- **JARVIS Chats**: No E2E (with user consent) - AI requires access to message content.
- **Public Channels**: No E2E - content is publicly visible.
- **Admin Access Permission**: Users can grant super admins temporary access to their DMs by sharing an encrypted key. Permissions can be revoked and expire automatically.
The system incorporates a unified subscription model with "Старт", "Про", and "Премиум" plans, offering varying content retention, AI requests, and features like interactive whiteboards and online notebooks. Seat-based billing is available for organizations. A donation system, promo codes, referral bonuses, and a manual payment system with admin verification are also integrated.

### AI Moderation and Communication Tools

The platform integrates a Jarvis AI Moderation System for automated content review. This system creates `ModerationCase` from abuse reports, analyzes content, generates `ModerationVerdict` with severity scores, and applies penalties (ban, warn, dismiss, escalate) automatically. An appeals system allows users to challenge verdicts. Jarvis also supports pre-recorded audio responses and a voicemail system for auto-answering calls and transcribing messages. Video uploads have restrictions on size, duration, and weekly quotas. Private channels are supported, visible only to invited members and administrators, with access controlled via a `ChannelMember` table. Educational tools like interactive whiteboards and online notebooks are available for higher-tier subscribers, with plan-based gating and security features.

## External Dependencies

### Frontend Libraries

- **react / react-dom**: UI Library
- **wouter**: Client-side routing
- **zustand**: Global state management
- **@tanstack/react-query**: Server state management
- **socket.io-client**: WebSocket communication
- **framer-motion**: UI animations
- **lucide-react**: Icon library
- **date-fns**: Date manipulation
- **zod**: Schema validation
- **react-hook-form / @hookform/resolvers**: Form management

### Backend Technologies

- **gin**: HTTP web framework
- **gorm**: ORM for PostgreSQL
- **jwt-go**: JWT authentication

### Payment Gateway

- **YooKassa**: For premium billing and subscription processing.