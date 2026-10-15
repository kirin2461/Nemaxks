import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { PremiumBadge } from './PremiumBadge'
import { NotificationCenter } from './NotificationCenter'
import { BannerDisplay } from './BannerDisplay'
import { useToast } from './Toast'
import {
  Home,
  MessageSquare,
  Hash,
  Settings,
  User,
  LogOut,
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
  const { t } = useTranslation()
  const { user, logout, isDemoMode, notifications, liteMode } = useStore()
  const { unreadCount } = useNotifications()
  const [location] = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toast = useToast()

  const isAdmin = user?.role === 'admin' || user?.role === 'moderator'
  const isSuperAdmin = user?.role === 'super_admin'

  const totalMessageBadge = Math.max(notifications.messages, unreadCount)

  // Full navigation for standard mode
  const fullNavigation = [
    { name: t('nav.home'), href: '/', icon: Home, badge: 0 },
    { name: t('nav.feed'), href: '/feed', icon: Rss, badge: 0 },
    { name: t('nav.video'), href: '/video', icon: Video, badge: 0 },
    { name: t('nav.calls'), href: '/call', icon: Phone, badge: 0 },
    { name: t('nav.jarvis'), href: '/jarvis', icon: Sparkles, badge: 0 },
    { name: t('nav.friends'), href: '/friends', icon: Users, badge: notifications.friends },
    { name: t('nav.messages'), href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: t('nav.channels'), href: '/channels', icon: Hash, badge: notifications.channels },
    { name: t('common.profile'), href: '/profile', icon: User, badge: 0 },
    { name: t('nav.premium'), href: '/premium', icon: Crown, badge: 0 },
    { name: t('nav.reports'), href: '/reports', icon: FileText, badge: 0 },
    { name: t('nav.invite'), href: '/invite', icon: UserPlus, badge: 0 },
    { name: t('common.settings'), href: '/settings', icon: Settings, badge: 0 },
    ...(isAdmin ? [{ name: t('nav.admin'), href: '/admin', icon: Shield, badge: 0 }] : []),
    ...(isSuperAdmin ? [{ name: t('nav.superAdmin'), href: '/admin/super', icon: Crown, badge: 0 }] : []),
  ]

  // Simplified navigation for lite mode - only essential items
  const liteNavigation = [
    { name: t('nav.home'), href: '/', icon: Home, badge: 0 },
    { name: t('nav.messages'), href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: t('nav.friends'), href: '/friends', icon: Users, badge: notifications.friends },
    { name: t('nav.channels'), href: '/channels', icon: Hash, badge: notifications.channels },
    { name: t('common.profile'), href: '/profile', icon: User, badge: 0 },
    { name: t('common.settings'), href: '/settings', icon: Settings, badge: 0 },
  ]

  const navigation = liteMode ? liteNavigation : fullNavigation

  const bottomNavItems = liteMode ? [
    { name: t('nav.home'), href: '/', icon: Home },
    { name: t('nav.messages'), href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: t('nav.friends'), href: '/friends', icon: Users, badge: notifications.friends },
    { name: t('common.settings'), href: '/settings', icon: Settings },
  ] : [
    { name: t('nav.home'), href: '/', icon: Home },
    { name: t('nav.feed'), href: '/feed', icon: Rss },
    { name: t('nav.messages'), href: '/messages', icon: MessageSquare, badge: totalMessageBadge },
    { name: t('nav.friends'), href: '/friends', icon: Users, badge: notifications.friends },
    { name: t('common.profile'), href: '/profile', icon: User },
  ]

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="h-app-shell bg-background flex flex-col relative z-10 overflow-hidden">
      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-warning-soft border-b border-border px-4 py-2 text-center">
          <p className="text-sm text-[hsl(32_95%_30%)]">
            <strong>Demo Mode:</strong> Backend not connected. Exploring UI only.
          </p>
        </div>
      )}

      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-3 border-b border-border bg-card sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors duration-150"
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
          className="lg:hidden fixed inset-0 bg-graphite-950/40 z-50 animate-fade-in-soft"
          onClick={closeSidebar}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar - Hidden on mobile, shown as overlay when open */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-[60] w-64 bg-card border-r border-border flex flex-col shrink-0 transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo and close button for mobile */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Logo size="md" showText />
            <button
              onClick={closeSidebar}
              className="lg:hidden p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors duration-150"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Navigation</span>
              <button 
                className="p-1 hover:bg-accent hover:text-accent-foreground rounded-md text-muted-foreground transition-colors duration-150 z-50 relative" 
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Функция скоро появится!');
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
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
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
          <div className="p-4 border-t border-border space-y-1">
            {/* User info */}
            <Link href="/profile" onClick={closeSidebar} className="sidebar-item relative z-50">
              <Avatar
                src={user?.avatar || undefined}
                alt={user?.username || 'User'}
                userId={user?.id?.toString() || '0'}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">
                    {user?.alias || user?.username}
                  </p>
                  {user?.premium?.active && (
                    <PremiumBadge
                      planName={user.premium.plan_name}
                      tier={user.premium.tier}
                      className="shrink-0"
                    />
                  )}
                </div>
              </div>
            </Link>

            {/* Logout */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                logout();
                closeSidebar();
              }} 
              className="sidebar-item w-full text-destructive hover:bg-danger-soft relative z-50"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 min-w-0 overflow-auto bg-background pb-20 lg:pb-0">
          <BannerDisplay />
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-area-bottom shadow-elev">
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
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
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
