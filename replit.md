# Nemaks - Modern Communication Platform

## Overview

Nemaks is a modern, real-time communication platform offering Discord-style features such as real-time messaging, channels, ephemeral stories, and an integrated AI assistant. The platform's core purpose is to deliver a comprehensive and engaging communication experience, supported by robust admin tools, multimedia capabilities, and extensive customization. Key features include real-time interactions via WebSockets, a 5-star post rating system, multi-language support (Russian and English), and an advanced admin panel for managing users and content. The project aims to provide a secure, responsive, and feature-rich environment for user interaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18.3 and TypeScript 5.6, utilizing Vite 6 for efficient development. State management is handled by Zustand for global state and React Query for server-side data caching. Styling is implemented with Tailwind CSS 3, adhering to a custom design system, and animations are powered by Framer Motion. The architecture emphasizes modularity, with distinct sections for reusable components, pages, core utilities, and styles. It includes dynamic Stories, interactive StarRating components, real-time TypingIndicators, and a comprehensive AdminPanel. Mobile responsiveness is a fundamental design principle, achieved through a mobile header, bottom navigation bar, and adaptable layouts across all pages. UI enhancements include multiple theme options with dynamic backgrounds, a new ConfirmDialog component for user actions, and optimized build processes.

### Backend

The backend is developed in Go using the Gin framework, providing a RESTful API secured with JWT-based authentication. PostgreSQL serves as the database, managed through the GORM ORM. The architecture supports core functionalities such as user management, guild/channel systems, real-time messaging, stories with 24-hour expiration, and a 5-star rating system. It incorporates robust content filtering with forbidden words and regex support, IP banning, abuse reporting, and audit logging. WebSocket integration is central to enabling real-time features like messaging, typing indicators, and online status. Security measures include bcrypt for password hashing, WebSocket origin validation, and JWT signing method validation. The system also supports WebRTC for voice and video calls with a mesh network topology, dynamic ICE server configuration, and STUN/TURN server support for NAT traversal.

### Data Flow and Key Features

Authentication relies on JWT tokens. User sessions and UI preferences are managed via a Zustand store. API calls are centralized and strongly typed. Real-time updates occur via WebSocket, supporting features like real-time channel messages, typing indicators, and presence. The platform supports internationalization with Russian and English translations. Advanced features include 24-hour disappearing Stories, 5-star post ratings, post bookmarks, likes, subscriptions, message reactions, reply quoting, message forwarding, pinned messages, audio/video uploads, and an AI assistant. Voice/Video calls are WebRTC-based with multi-party support, screen sharing, noise suppression, and incoming call notifications. Admin tools include a full admin panel for user management, IP bans, abuse reports, audit logs, and content filtering. Security features encompass IP banning, content filtering, and QR code login. Monetization is handled via a premium billing system with subscription plans and donation capabilities, integrated with payment gateways like YooKassa. User support is facilitated by a request system with categorization, priority levels, and status tracking. The feed supports clickable tags for filtering, infinite scroll, and various sorting options (All Posts, Following, Trending, My Posts).

## External Dependencies

### Frontend

- **react / react-dom**: Core UI library.
- **wouter**: Client-side routing.
- **zustand**: Global state management.
- **@tanstack/react-query**: Server state management and caching.
- **socket.io-client**: WebSocket client for real-time communication.
- **framer-motion**: UI animations.
- **lucide-react**: Icon library.
- **date-fns**: Date manipulation utilities.
- **zod**: Schema validation.
- **react-hook-form / @hookform/resolvers**: Form management.

### Backend

- **gin**: HTTP web framework.
- **gorm**: ORM for PostgreSQL.
- **jwt-go**: JWT authentication.

### Payment Gateway

- **YooKassa**: For premium billing and subscription processing.

## Monetization System (January 2026)

### Premium Subscriptions
- **3 Tiers**: Basic, Pro, VIP with different feature sets
- **3 Billing Periods**: Monthly, Quarterly (15% off), Annual (25% off)
- **Auto-Renewal**: Server-side charging using saved payment methods via `CreatePaymentWithSavedMethod`
- **Payment Retry**: Failed renewals retry up to 3 times over 72 hours
- **Scheduler**: Runs at midnight (renewals), every 6 hours (retries), 8 AM (expiration reminders)

### Promo Codes
- Supports percent and fixed discounts
- Min purchase requirements and usage limits
- Per-user tracking via PromoCodeUsage model
- Admin CRUD endpoints for managing codes

### Trial Period
- 7-day free trial for new users
- One trial per user, tracked in database
- Automatically creates premium subscription

### Gift Subscriptions
- Purchase gifts for other users with unique codes (GIFT-XXXXXXXX)
- Redeem endpoint to activate gift
- Gift message and tracking

### Referral Bonuses
- Users get unique referral codes
- When referred user subscribes to premium, referrer gets 7 days free
- Extends existing subscription or creates new one

### Post Boosting
- Featured (99-249₽), Trending (199-499₽), Top (399-999₽) placements
- 24 or 72 hour duration options
- Premium users get 20% discount
- Activated via YooKassa payment webhook

### Email Notifications
- Payment confirmation emails
- Subscription expiring reminders (3 days before)
- Cancellation/refund confirmations
- Requires SMTP credentials: SMTP_HOST, SMTP_USER, SMTP_PASSWORD

### Admin Billing Panel
- MRR (Monthly Recurring Revenue) calculation
- Churn rate tracking
- Transaction history with filtering
- Refund processing

## Unified Subscription System (January 2026)

### Unified Subscription Plans
Three consolidated plans serving both individual users and organizations:

- **Старт** (start): Бесплатный план — 7 дней хранения видео, 30 дней сообщений, 3 запроса Jarvis AI в день. Базовые функции для начала работы.
- **Про** (pro): 499₽/мес — 30 дней видео, 90 дней сообщений, 20 Jarvis AI запросов/день. HD видео, эксклюзивные темы, докупка хранилища. Для активных пользователей и курсов.
- **Премиум** (premium): 1990₽/мес — 90 дней видео, 365 дней сообщений, 999 (безлимит) Jarvis AI запросов/день. Интерактивные доски и тетради, отчёты по трафику, приоритетная поддержка. Для организаций и VIP-пользователей.

### Seat-Based Billing (for Organizations)
Only applies to Про and Премиум plans when used by organizations:
- **student_editor**: 35₽/month - Full editing rights
- **staff**: 500₽/month - Instructor/admin capabilities
- **reader**: 0₽ - View-only access
- Monthly billing calculated as: base_price + (student_editors × 35) + (staff × 500)

### Content Retention & Overage Storage
- Automatic content deletion after plan limits
- Overage storage: 50₽/GB-month for keeping content beyond limits
- Only available for Про and Премиум plans
- Admin can enable/disable overage per organization

### Jarvis AI Usage
- Daily limits per plan (3/20/999 requests)
- Usage tracked per user/organization
- Resets at midnight each day

### Templates System
- **Guild Templates**: Pre-configured servers (community, edu-course, university, gaming, business)
- **Channel Templates**: Ready-to-use channels (lecture, seminar, homework, whiteboard, notebook, voice, video, chat)
- Plan-based access: Some templates require Про or Премиум

### Donations System
- Support platform author with donations
- Minimum amount: 20₽
- Quick donation buttons: 20, 50, 100, 500₽
- Custom amount support

### Manual Payment System
- Card transfer option for users without online payment
- Admin verification workflow
- Status tracking: pending → approved/rejected
- Subscription activation upon approval

### Admin Organization Panel
- Organization management (create, view, update)
- Subscription management
- Template management
- Manual payment verification
- Donation tracking

## Jarvis AI Moderation System (January 2026)

### Automated Moderation
- **ModerationCase**: Created from AbuseReport, tracks target user, reporter, content type, priority
- **ModerationVerdict**: AI-generated verdict (ban, warn, dismiss, escalate) with confidence score
- **ModerationActionLog**: Full audit trail of all moderation actions

### Jarvis Review Process
1. Report submitted → ModerationCase created automatically
2. Jarvis analyzes content using ForbiddenWord patterns and report reason
3. Severity score (0-1) determines verdict type:
   - ≥0.8: Ban (24h default)
   - ≥0.5: Warning
   - ≥0.3: Escalate to admin
   - <0.3: Dismiss
4. Penalty applied automatically if ban/warn

### Appeals System
- Users can appeal verdicts via POST /api/appeals
- Super admins review appeals in admin panel
- Approved appeals: verdict overridden, ban removed
- Rejected appeals: documented with notes

### Pre-recorded Audio Responses
- JarvisAudioResponse: Stores pre-recorded voice files for Jarvis
- Categories: moderation, greeting, system
- Used for verdicts, appeal confirmations, etc.

### Voicemail System
- JarvisCallSession: Auto-answer calls when user unavailable
- Voicemail: Record and transcribe voice messages
- Message routing to appropriate user/channel

### Video Upload Restrictions
- Maximum file size: 500 MB
- Maximum duration: 120 minutes
- Weekly quota: 3 videos per user (rolling 7-day window)
- Duration validated client-side using HTML5 Video API