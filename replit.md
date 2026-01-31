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

### Super Admin Dashboard (Phase 12)

A comprehensive super admin panel at `/admin/super` with the following capabilities:
- **User Management**: List, search, filter users by role/status; view detailed profiles; block/unblock; reset passwords; change roles (user/moderator/admin/super_admin); view and revoke active sessions
- **Guild Management**: List all guilds with statistics; transfer ownership; delete guilds with cascade cleanup
- **Content Moderation**: View abuse reports; delete messages/posts; integrated with existing moderation system
- **System Monitoring**: Real-time service status (Database, Redis, LiveKit); security logs with action filtering; failed login tracking
- **JARVIS Administration**: Usage statistics; top users by request count; per-user usage analysis

All super admin endpoints are protected by `superAdminMiddleware()` which enforces `super_admin` role requirement.

### Phase 1 Features: Gamification & Engagement (New)

#### Achievement & Level System
- **Achievements**: 16 default achievements across categories (social, voice, content, progression, reputation, loyalty)
- **XP System**: Users earn XP for messages, reactions, voice time, posts, and poll participation
- **Levels**: Progressive leveling with increasing XP requirements (1.15x multiplier per level)
- **Leaderboards**: Global and per-guild leaderboards with weekly/monthly/all-time filters
- **Rarity tiers**: common, uncommon, rare, epic, legendary achievements

#### Polls & Voting
- **Poll creation**: Multi-option polls with optional expiration time
- **Voting options**: Single or multiple choice, anonymous voting support
- **Poll management**: Authors can close polls, results show percentages and vote counts
- **XP rewards**: Users earn XP for creating polls (+15) and voting (+5)

#### Custom Statuses
- **Status messages**: Custom text + emoji status visible to other users
- **Auto-expiry**: Optional duration (30min, 1hr, 4hr, today)
- **Presets**: Default presets (Working, Gaming, Music, etc.) + custom user presets
- **Status persistence**: Automatic cleanup of expired statuses

#### Disappearing Messages
- **Per-conversation toggle**: Enable/disable per DM conversation
- **Duration options**: 1 minute, 5 minutes, 1 hour, 1 day, 1 week
- **Background cleanup**: Automated job cleans up expired messages every minute
- **Privacy focused**: Messages permanently deleted after expiry

### Phase 2 Features: Advanced Gamification (New)

#### Virtual Currency & Rewards Store
- **Dual currency**: Coins (earned through activity) and Gems (premium/rare rewards)
- **Shop system**: Themes, frames, and banners purchasable with coins or gems
- **Inventory management**: Track owned items and equipped customizations
- **Rarity tiers**: common, uncommon, rare, epic, legendary items

#### Challenges & Quests
- **Daily challenges**: Quick tasks like sending messages, adding reactions
- **Weekly challenges**: Larger goals with bigger rewards
- **Special challenges**: Unique achievements like login streaks
- **Auto-reset**: Daily challenges reset at midnight, weekly on Mondays

#### Streaks & Activity Tracking
- **Login streaks**: Track consecutive login days with milestone rewards
- **Message streaks**: Track daily messaging activity
- **Streak rewards**: Bonus coins, gems, and XP for maintaining streaks
- **Lucky wheel**: Spin for random prizes using coins

#### Guild Competitions
- **Tournament system**: Guilds compete on metrics like messages, voice time
- **Leaderboards**: Real-time ranking of participating guilds
- **Prize pools**: Winners receive coins, gems, and exclusive rewards
- **Competition lifecycle**: Active, upcoming, and ended competitions

#### Profile Customization
- **Themes**: Custom color schemes for profile appearance
- **Frames**: Decorative borders around profile pictures
- **Banners**: Custom header images for profiles
- **Badges**: Special icons for achievements and roles
- **Privacy controls**: Toggle visibility of level, achievements, activity

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