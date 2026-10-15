import React, { useEffect } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { useStore } from './lib/store'
import { JarvisVoiceProvider } from './contexts/JarvisVoiceContext'
import { JarvisFloatingIndicator } from './components/JarvisFloatingIndicator'
import { NotificationProvider } from './contexts/NotificationContext'
import { VoiceProvider } from './contexts/VoiceContext'
import { LiveKitProvider } from './contexts/LiveKitContext'
import { AppStateProvider } from './contexts/AppStateContext'
import { IncomingCallNotification } from './components/IncomingCallNotification'
import { ConnectionStatusIndicator } from './components/ConnectionStatusIndicator'
import { ToastContainer } from './components/Toast'
import { LanguageProvider } from './contexts/LanguageContext'


// Pages
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
const FeedPage = React.lazy(() => import('./pages/FeedPage'))
const VideoPage = React.lazy(() => import('./pages/VideoPage'))
const VideoCallPage = React.lazy(() => import('./pages/VideoCallPage'))
const JarvisPage = React.lazy(() => import('./pages/JarvisPage'))
const MessagesPage = React.lazy(() => import('./pages/handleReactToMessage'))
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
const SupportPage = React.lazy(() => import('./pages/SupportPage'))
const PremiumPage = React.lazy(() => import('./pages/PremiumPage'))
const PremiumCheckoutPage = React.lazy(() => import('./pages/PremiumCheckoutPage'))
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'))
const TemplatesPage = React.lazy(() => import('./pages/TemplatesPage'))
const SuperAdminPage = React.lazy(() => import('./pages/SuperAdminPage'))
const AchievementsPage = React.lazy(() => import('./pages/AchievementsPage'))
const ShopPage = React.lazy(() => import('./pages/ShopPage'))
const ChallengesPage = React.lazy(() => import('./pages/ChallengesPage'))
const CompetitionsPage = React.lazy(() => import('./pages/CompetitionsPage'))
const ProfileCustomizationPage = React.lazy(() => import('./pages/ProfileCustomizationPage'))
const EventsPage = React.lazy(() => import('./pages/EventsPage'))
const MiniGamesPage = React.lazy(() => import('./pages/MiniGamesPage'))
const QuestsPage = React.lazy(() => import('./pages/QuestsPage'))
const ActivityFeedPage = React.lazy(() => import('./pages/ActivityFeedPage'))
const GiftsPage = React.lazy(() => import('./pages/GiftsPage'))
const TradesPage = React.lazy(() => import('./pages/TradesPage'))
const ClansPage = React.lazy(() => import('./pages/ClansPage'))
const CollectionsPage = React.lazy(() => import('./pages/CollectionsPage'))
const MentorshipPage = React.lazy(() => import('./pages/MentorshipPage'))
const TrendingPage = React.lazy(() => import('./pages/TrendingPage'))
const FraudDashboardPage = React.lazy(() => import('./pages/FraudDashboardPage'))
const LicenseActivationPage = React.lazy(() => import('./pages/LicenseActivationPage'))
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'))
const TermsPage = React.lazy(() => import('./pages/TermsPage'))
const ContactPage = React.lazy(() => import('./pages/ContactPage'))
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'))
const NotificationSettingsPage = React.lazy(() => import('./pages/NotificationSettingsPage'))
const ToolEditorPage = React.lazy(() => import('./pages/ToolEditorPage'))

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
    return <Redirect to="/welcome" />
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
  const { checkAuth } = useStore()

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <LanguageProvider>
      <AppStateProvider>
        <NotificationProvider>
          <LiveKitProvider>
            <VoiceProvider>
              <JarvisVoiceProvider>
                <React.Suspense fallback={<LoadingScreen />}>
                  <JarvisFloatingIndicator />
                  <IncomingCallNotification />
                  <ConnectionStatusIndicator />
                  <Switch>
                {/* Public routes */}
                <Route path="/welcome">
                  <PresentationPage />
                </Route>

                <Route path="/activate">
                  <LicenseActivationPage />
                </Route>

                <Route path="/privacy">
                  <PrivacyPage />
                </Route>

                <Route path="/terms">
                  <TermsPage />
                </Route>

                <Route path="/contact">
                  <ContactPage />
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

                <Route path="/tools/:tool_id">
                  <ProtectedRoute>
                    <ToolEditorPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/friends">
                  <ProtectedRoute>
                    <FriendsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/notifications">
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/notifications/settings">
                  <ProtectedRoute>
                    <NotificationSettingsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/profile/:userId?">
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                </Route>

                <Route path="/achievements/:userId?">
                  <ProtectedRoute>
                    <AchievementsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/shop">
                  <ProtectedRoute>
                    <ShopPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/challenges">
                  <ProtectedRoute>
                    <ChallengesPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/competitions">
                  <ProtectedRoute>
                    <CompetitionsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/profile/customize">
                  <ProtectedRoute>
                    <ProfileCustomizationPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/events">
                  <ProtectedRoute>
                    <EventsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/minigames">
                  <ProtectedRoute>
                    <MiniGamesPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/quests">
                  <ProtectedRoute>
                    <QuestsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/activity">
                  <ProtectedRoute>
                    <ActivityFeedPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/gifts">
                  <ProtectedRoute>
                    <GiftsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/trades">
                  <ProtectedRoute>
                    <TradesPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/clans">
                  <ProtectedRoute>
                    <ClansPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/collections">
                  <ProtectedRoute>
                    <CollectionsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/mentorship">
                  <ProtectedRoute>
                    <MentorshipPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/trending">
                  <ProtectedRoute>
                    <TrendingPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/support/:userId">
                  <ProtectedRoute>
                    <SupportPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/premium">
                  <PremiumPage />
                </Route>

                <Route path="/premium/checkout">
                  <ProtectedRoute>
                    <PremiumCheckoutPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/reports">
                  <ProtectedRoute>
                    <ReportsPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/admin/fraud">
                  <ProtectedRoute>
                    <FraudDashboardPage />
                  </ProtectedRoute>
                </Route>

                <Route path="/templates">
                  <ProtectedRoute>
                    <TemplatesPage />
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

                <Route path="/admin/super">
                  <ProtectedRoute>
                    <SuperAdminPage />
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

                {/* Home - must be last before 404 */}
                <Route path="/">
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
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
                  <ToastContainer />
                </React.Suspense>
              </JarvisVoiceProvider>
            </VoiceProvider>
          </LiveKitProvider>
        </NotificationProvider>
      </AppStateProvider>
    </LanguageProvider>
  )
}

export default App
