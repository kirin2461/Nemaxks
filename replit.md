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