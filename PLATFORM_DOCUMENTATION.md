# Nemaks Platform Documentation

## Overview

Nemaks is a modern, real-time communication platform offering Discord-style features including real-time messaging, channels, ephemeral stories, and an integrated AI assistant called Jarvis.

## Core Features

### Communication

#### Real-time Messaging
- Instant message delivery via WebSocket
- Rich text formatting and media support
- Message reactions with 8 quick emojis
- Reply quoting and message forwarding
- Pinned messages in channels
- Typing indicators ("username печатает...")
- Message editing and deletion

#### Channels
- Text, voice, and video channels
- Channel categories with collapsible sections
- Unread indicators (white dot, bold text)
- Private channels visible only to invited members
- "Nemaks Общий" - always public community channel

#### Voice & Video Calls
- WebRTC-based multi-party calls
- Screen sharing
- Noise suppression
- STUN/TURN support for NAT traversal
- Incoming call notifications

### Social Features

#### Stories
- 24-hour disappearing content
- Media support (images, video)
- View tracking

#### Feed
- 5-star post rating system
- Likes and bookmarks
- Clickable tags for filtering
- Infinite scroll
- Sorting: All Posts, Following, Trending, My Posts

#### Friends
- Friend requests and management
- Online status indicators
- Direct messaging

### AI Assistant (Jarvis)

- Natural language interaction
- Task management assistance
- Pre-recorded audio responses
- Categories: moderation, greeting, system
- Voicemail system with transcription
- Daily usage limits per subscription plan

### Content Moderation

#### Automated System
- Abuse report processing
- AI-generated verdicts (ban, warn, dismiss, escalate)
- Confidence scoring
- Full audit trail

#### Appeals
- User-initiated appeals
- Super admin review
- Override capabilities

## Subscription Plans

### Unified Plans

| Feature | Старт (Free) | Про (499₽/mo) | Премиум (1990₽/mo) |
|---------|--------------|---------------|---------------------|
| Video storage | 7 days | 30 days | 90 days |
| Message history | 30 days | 90 days | 365 days |
| Jarvis AI requests/day | 3 | 20 | 999 (unlimited) |
| HD Video | No | Yes | Yes |
| Exclusive themes | No | Yes | Yes |
| Interactive boards | No | No | Yes |
| Online notebooks | No | No | Yes |
| Priority support | No | No | Yes |

### Billing Periods
- Monthly: Base price
- Quarterly: 15% discount
- Annual: 25% discount

### Organization Features (Про/Премиум)
Seat-based billing:
- **student_editor**: 35₽/month
- **staff**: 500₽/month
- **reader**: 0₽ (free)

## Educational Tools

### Interactive Whiteboards (Про+ Plan)
- Canvas-based drawing
- Tools: pencil, eraser, shapes, text
- Configurable colors and stroke widths
- Visibility: all, moderators, owner

### Online Notebooks (Премиум Plan)
- Rich-text block editor
- Block types: text, headings, lists, code
- Content stored as JSON

## Private Channels

### Access Control
- `is_private: true` hides channel from non-members
- Visible to: invited members, guild owners, platform admins
- Guild-level moderators with PermAdministrator/PermManageChannels
- "Nemaks Общий" always public

### Member Management
- ChannelMember table tracks access
- Creator automatically added as member

## Templates

### Guild Templates
- community
- edu-course
- university
- gaming
- business

### Channel Templates
- lecture
- seminar
- homework
- whiteboard
- notebook
- voice
- video
- chat

## Payment Integration

### YooKassa
- Subscription processing
- Auto-renewal with saved payment methods
- Payment retry (3 attempts over 72 hours)

### Promo Codes
- Percent and fixed discounts
- Minimum purchase requirements
- Usage limits and per-user tracking

### Gift Subscriptions
- Unique gift codes (GIFT-XXXXXXXX)
- Gift messages
- Recipient activation

### Referral Program
- Unique referral codes
- 7-day free premium for referrer when referred user subscribes

### Post Boosting
- Featured: 99-249₽
- Trending: 199-499₽
- Top: 399-999₽
- Duration: 24 or 72 hours
- 20% discount for premium users

### Manual Payments
- Card transfer option
- Admin verification workflow
- Status: pending → approved/rejected

## Security

### Authentication
- JWT-based tokens
- QR code login
- bcrypt password hashing
- WebSocket origin validation

### Content Filtering
- Forbidden words list
- Regex pattern matching
- IP banning

### Video Upload Limits
- Max file size: 500 MB
- Max duration: 120 minutes
- Weekly quota: 3 videos per user

## Technical Architecture

### Frontend
- React 18.3 + TypeScript 5.6
- Vite 6 for development
- Zustand for state management
- React Query for server caching
- Tailwind CSS 3 for styling
- Framer Motion for animations
- Socket.io for WebSocket

### Backend
- Go with Gin framework
- PostgreSQL with GORM
- JWT authentication
- WebSocket for real-time features

### API Endpoints

Base URL: `/api`

#### Authentication
- POST `/auth/register` - User registration
- POST `/auth/login` - User login
- GET `/auth/me` - Get current user

#### Channels
- GET `/guilds/:guildId/channels` - List channels
- POST `/guilds/:guildId/channels` - Create channel
- GET `/channels/:id` - Get channel
- PUT `/channels/:id` - Update channel
- DELETE `/channels/:id` - Delete channel

#### Messages
- GET `/channels/:id/messages` - Get messages
- POST `/channels/:id/messages` - Send message
- PUT `/messages/:id` - Edit message
- DELETE `/messages/:id` - Delete message

#### Subscriptions
- GET `/subscriptions/plans` - List plans
- POST `/subscriptions` - Create subscription
- GET `/subscriptions/current` - Get current subscription

#### Admin
- GET `/admin/users` - List users
- POST `/admin/users/:id/ban` - Ban user
- GET `/admin/reports` - Get abuse reports
- GET `/admin/moderation/cases` - Get moderation cases

## WebSocket Events

### Client → Server
- `join_channel` - Join a channel
- `leave_channel` - Leave a channel
- `send_message` - Send message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator

### Server → Client
- `new_message` - New message received
- `message_edited` - Message was edited
- `message_deleted` - Message was deleted
- `user_typing` - User is typing
- `user_online` - User came online
- `user_offline` - User went offline
- `reaction_add` - Reaction added
- `reaction_remove` - Reaction removed

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret

### Email (for notifications)
- `SMTP_HOST` - SMTP server host
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password

### Payments
- `YOOKASSA_SHOP_ID` - YooKassa shop ID
- `YOOKASSA_SECRET_KEY` - YooKassa secret key

## Localization

Supported languages:
- Russian (default)
- English

## Mobile Support

- Responsive design for all screens
- Mobile header navigation
- Bottom navigation bar
- Touch-optimized interactions

---

*Last updated: January 2026*
