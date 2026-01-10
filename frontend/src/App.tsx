import React, { useEffect } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { useStore } from './lib/store'
import { JarvisVoiceProvider } from './contexts/JarvisVoiceContext'
import { JarvisFloatingIndicator } from './components/JarvisFloatingIndicator'
import { NotificationProvider } from './contexts/NotificationContext'
import { VoiceProvider } from './contexts/VoiceContext'
import { AppStateProvider } from './contexts/AppStateContext'
import { IncomingCallNotification } from './components/IncomingCallNotification'


// Pages (lazy loaded)
const AuthPage = React.lazy(() => import('./pages/AuthPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const FeedPage = React.lazy(() => import('./pages/FeedPage'))
const VideoPage = React.lazy(() => import('./pages/VideoPage'))
const VideoCallPage = React.lazy(() => import('./pages/VideoCallPage'))
const JarvisPage = React.lazy(() => import('./pages/JarvisPage'))
const MessagesPage = React.lazy(() => import('./pages/MessagesPage'))
const ChannelsPage = React.lazy(() => import('./pages/ChannelsPage'))
const FriendsPage = React.lazy(() => import('./pages/FriendsPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'))
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'))
const QRConfirmPage = React.lazy(() => import('./pages/QRConfirmPage'))
const PresentationPage = React.lazy(() => import('./pages/PresentationPage'))
const InvitePage = React.lazy(() => import('./pages/InvitePage'))
const JoinPage = React.lazy(() => import('./pages/JoinPage'))
const ServerJoinPage = React.lazy(() => import('./pages/ServerJoinPage'))

// Loading component with skeleton animation
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground animate-pulse">Загрузка...</p>
      </div>
    </div>
  )
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useStore()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />
  }

  return <>{children}</>
}

// Public route wrapper (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useStore()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Redirect to="/" />
  }

  return <>{children}</>
}

function App() {
  const { checkAuth, setTheme, theme } = useStore()

  useEffect(() => {
    checkAuth()
    setTheme(theme)
  }, [])

  return (
    <AppStateProvider>
    <NotificationProvider>
    <VoiceProvider>
    <JarvisVoiceProvider>
    <React.Suspense fallback={<LoadingScreen />}>
      <JarvisFloatingIndicator />
      <Switch>
        {/* Public routes */}
        <Route path="/welcome">
          <PresentationPage />
        </Route>

        <Route path="/auth">
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        </Route>

        {/* QR Login confirmation - handles its own auth check */}
        <Route path="/qr-confirm/:token">
          <QRConfirmPage />
        </Route>

        {/* Protected routes */}
        <Route path="/">
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        </Route>

        <Route path="/feed">
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        </Route>

        <Route path="/video">
          <ProtectedRoute>
            <VideoPage />
          </ProtectedRoute>
        </Route>

        <Route path="/call">
          <ProtectedRoute>
            <VideoCallPage />
          </ProtectedRoute>
        </Route>

        <Route path="/call/:userId">
          <ProtectedRoute>
            <VideoCallPage />
          </ProtectedRoute>
        </Route>

        <Route path="/jarvis">
          <ProtectedRoute>
            <JarvisPage />
          </ProtectedRoute>
        </Route>

        <Route path="/messages">
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/channels">
          <ProtectedRoute>
            <ChannelsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/friends">
          <ProtectedRoute>
            <FriendsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/profile/:userId?">
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        </Route>

        <Route path="/settings">
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/admin">
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        </Route>

        <Route path="/invite">
          <ProtectedRoute>
            <InvitePage />
          </ProtectedRoute>
        </Route>

        <Route path="/join/:code">
          <JoinPage />
        </Route>

        <Route path="/invite/:code">
          <ServerJoinPage />
        </Route>

        {/* 404 */}
        <Route>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
              <p className="text-muted-foreground mb-6">Page not found</p>
              <a href="/" className="button-primary">
                Go Home
              </a>
            </div>
          </div>
        </Route>
      </Switch>
    </React.Suspense>
    </JarvisVoiceProvider>
    </VoiceProvider>
    </NotificationProvider>
      <IncomingCallNotification />
      </AppStateProvider>
  )
}

export default App
