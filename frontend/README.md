# Nemaks Frontend - Modern Chat Platform

Modern, responsive frontend for the Nemaks chat platform built with React, TypeScript, and Tailwind CSS.

## Features

- **Modern UI/UX**: Beautiful cosmic-themed interface with multiple theme options (Dark, Light, Cosmic)
- **Real-time Messaging**: Direct messaging with WebSocket support
- **Channel System**: Text and voice channels (Discord-style)
- **User Profiles**: Customizable profiles with avatars, bios, and stats
- **Settings**: Comprehensive settings for appearance, notifications, privacy, and integrations
- **Responsive Design**: Mobile-first design that works on all devices
- **AI Assistant**: Jarvis AI integration for enhanced user experience

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript 5** - Type-safe development
- **Vite 6** - Lightning-fast build tool
- **Tailwind CSS 3** - Utility-first CSS framework
- **Wouter** - Lightweight routing
- **Zustand** - Simple state management
- **Framer Motion** - Smooth animations (optional)
- **Lucide React** - Beautiful icon library

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Layout.tsx
│   ├── pages/           # Page components
│   │   ├── AuthPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── ChannelsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── SettingsPage.tsx
│   ├── lib/             # Core utilities
│   │   ├── api.ts       # API client
│   │   ├── store.ts     # State management
│   │   └── utils.ts     # Helper functions
│   ├── styles/          # Global styles
│   │   ├── globals.css
│   │   └── components.css
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies

```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server will start on `http://localhost:5173`

## Backend Connection

The frontend is configured to connect to a Rust backend running on `http://localhost:8000`.

API endpoints are proxied through Vite:
- `/api/*` → Backend API
- `/uploads/*` → Static file uploads

Update `vite.config.ts` to change the backend URL.

## Themes

Three built-in themes:
- **Dark** - Modern dark theme (default)
- **Light** - Clean light theme
- **Cosmic** - Purple gradient cosmic theme

Theme can be changed in Settings or via the sidebar.

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

## Features Roadmap

- [x] Authentication (Login/Register)
- [x] User Profiles
- [x] Direct Messaging
- [x] Settings Panel
- [ ] Voice/Video Calls
- [ ] Channel Messages
- [ ] File Uploads
- [ ] Real-time Notifications
- [ ] Jarvis AI Integration
- [ ] Mobile App

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
