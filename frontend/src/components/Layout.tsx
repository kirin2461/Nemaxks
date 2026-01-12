import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { NotificationCenter } from './NotificationCenter'
import {
  Home,
  MessageSquare,
  Hash,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Sparkles,
  Video,
  Rss,
  Users,
  Plus,
  Phone,
  Shield,
  UserPlus,
  Menu,
  X,
  Crown,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, theme, setTheme, isDemoMode, notifications } = useStore()
  const { unreadCount } = useNotifications()
  const [location] = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'moderator'

  const totalMessageBadge = Math.max(notifications.messages, unreadCount)

  const navigation = [
    { name: 'Home', href: '/', icon: Home, badge: 0 },
    { name: 'Feed', href: '/feed', icon: Rss, badge: 0 },
    { name: 'Video', href: '/video', icon: Video, badge: 0 },
    { name: 'Calls', href: '/call', icon: Phone, badge: 0 },
    { name: 'Jarvis AI', href: '/jarvis', icon: Sparkles, badge: 0 },
    { name: 'Friends', href: '/friends', icon: Users, badge: notifications.friends },
    { name: 'Messages', href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: 'Channels', href: '/channels', icon: Hash, badge: notifications.channels },
    { name: 'Profile', href: '/profile', icon: User, badge: 0 },
    { name: 'Premium', href: '/premium', icon: Crown, badge: 0 },
    { name: 'Reports', href: '/reports', icon: FileText, badge: 0 },
    { name: 'Invite', href: '/invite', icon: UserPlus, badge: 0 },
    { name: 'Settings', href: '/settings', icon: Settings, badge: 0 },
    ...(isAdmin ? [{ name: 'Админ', href: '/admin', icon: Shield, badge: 0 }] : []),
  ]

  const bottomNavItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Feed', href: '/feed', icon: Rss },
    { name: 'Messages', href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: 'Friends', href: '/friends', icon: Users, badge: notifications.friends },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const handleThemeChange = (e: React.MouseEvent) => {
    e.preventDefault()
    const themes = [
      'dark', 'light', 'cosmic', 'nebula-winter', 'glass',
      'midnight-ocean', 'forest-night', 'sunset-glow', 'neon-tokyo', 'arctic-aurora'
    ] as const
    const currentIndex = themes.indexOf(theme as any)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />
      case 'cosmic':
        return <Sparkles className="w-5 h-5" />
      case 'nebula-winter':
        return <Sparkles className="w-5 h-5" style={{ color: '#60a5fa' }} />
      case 'glass':
        return <Sparkles className="w-5 h-5" style={{ opacity: 0.7 }} />
      default:
        return <Moon className="w-5 h-5" />
    }
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm flex flex-col relative z-10">
      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center">
          <p className="text-sm text-yellow-500">
            <strong>Demo Mode:</strong> Backend not connected. Exploring UI only.
          </p>
        </div>
      )}

      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-3 border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Logo size="sm" showText />
        <NotificationCenter />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile, shown as overlay when open */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card/95 backdrop-blur-md border-r border-border flex flex-col shrink-0 transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo and close button for mobile */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Logo size="md" showText />
            <button
              onClick={closeSidebar}
              className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</span>
              <button 
                className="p-1 hover:bg-accent rounded-md text-muted-foreground transition-colors z-50 relative" 
                onClick={(e) => {
                  e.preventDefault();
                  alert('Add functionality coming soon!');
                }}
                title="Add New"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location === item.href

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    'sidebar-item relative z-50',
                    isActive && 'active'
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border space-y-2">
            {/* Theme toggle */}
            <button
              onClick={handleThemeChange}
              className="sidebar-item w-full relative z-50"
              title={`Current theme: ${theme}`}
            >
              {getThemeIcon()}
              <span className="capitalize">{theme}</span>
            </button>

            {/* User info */}
            <Link href="/profile" onClick={closeSidebar} className="sidebar-item relative z-50">
              <Avatar
                src={user?.avatar || undefined}
                alt={user?.username || 'User'}
                userId={user?.id?.toString() || '0'}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.alias || user?.username}
                </p>
              </div>
            </Link>

            {/* Logout */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                logout();
                closeSidebar();
              }} 
              className="sidebar-item w-full text-red-500 relative z-50"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-background/50 pb-16 lg:pb-0">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
