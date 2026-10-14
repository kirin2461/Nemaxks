import React, { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { PremiumBadge } from '@/components/PremiumBadge'
import { Button } from '@/components/Button'
import { Input, Textarea } from '@/components/Input'
import { TelegramLink } from '@/components/TelegramLink'
import { MaxLink } from '@/components/MaxLink'
import { useStore } from '@/lib/store'
import { userAPI, UserProfile, UserStats } from '@/lib/api'
import { Edit, Save, X, Upload, UserPlus, UserMinus, Users, Crown, Heart, Share2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId?: string }>()
  const [, navigate] = useLocation()
  const { user, updateProfile, liteMode } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [premiumInfo, setPremiumInfo] = useState<{
    has_premium: boolean;
    plan_name?: string;
    current_period_end?: string;
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [alias, setAlias] = useState(user?.alias || '')
  const [bio, setBio] = useState(user?.bio || '')

  const isOwnProfile = !userId || userId === String(user?.id)

  useEffect(() => {
    const targetId = isOwnProfile ? user?.id : userId
    if (targetId) {
      loadProfile(String(targetId))
      loadStats(String(targetId))
      loadPremium(String(targetId))
    }
  }, [userId, user?.id, isOwnProfile])

  const loadProfile = async (id: string) => {
    if (isOwnProfile) return
    try {
      setProfileLoading(true)
      const data = await userAPI.getProfile(id)
      setProfileData(data)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const loadStats = async (id: string) => {
    try {
      const data = await userAPI.getStats(id)
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadPremium = async (id: string) => {
    try {
      const data = await userAPI.getPremium(id)
      setPremiumInfo(data)
    } catch (error) {
      console.error('Failed to load premium:', error)
    }
  }

  const displayUser = isOwnProfile ? user : profileData
  const followersCount = stats?.followers_count || profileData?.followers_count || 0
  const followingCount = stats?.following_count || profileData?.following_count || 0
  const friendsCount = stats?.friends_count || 0
  const postsCount = stats?.posts_count || 0
  const isSubscribed = profileData?.is_subscribed || false
  const hasPremium = premiumInfo?.has_premium || false

  const handleSubscribe = async () => {
    if (!userId || isOwnProfile) return
    try {
      setSubscribeLoading(true)
      await userAPI.subscribe(userId)
      setProfileData(prev => prev ? { 
        ...prev, 
        is_subscribed: true,
        followers_count: prev.followers_count + 1
      } : null)
      setStats(prev => prev ? {
        ...prev,
        followers_count: prev.followers_count + 1
      } : null)
    } catch (error) {
      console.error('Failed to subscribe:', error)
    } finally {
      setSubscribeLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!userId || isOwnProfile) return
    try {
      setSubscribeLoading(true)
      await userAPI.unsubscribe(userId)
      setProfileData(prev => prev ? { 
        ...prev, 
        is_subscribed: false,
        followers_count: Math.max(0, prev.followers_count - 1)
      } : null)
      setStats(prev => prev ? {
        ...prev,
        followers_count: Math.max(0, prev.followers_count - 1)
      } : null)
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
    } finally {
      setSubscribeLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      await updateProfile({
        alias: alias.trim() || undefined,
        bio: bio.trim() || undefined,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setAlias(user?.alias || '')
    setBio(user?.bio || '')
    setIsEditing(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      await userAPI.uploadAvatar(file)
      window.location.reload()
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setLoading(false)
    }
  }

  if (profileLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!isOwnProfile && !profileData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">User not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
        <Card className="glass rounded-xl shadow-soft overflow-hidden mb-6">
          <div className="relative">
            <div className="h-32 gradient-brand rounded-t-xl opacity-90" />

            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              {/* relative z-10: без этого контент с отрицательным margin
                  (-mt-12) уходит ПОД градиентный баннер — кнопка
                  Edit Profile "проваливалась" за фон профиля */}
              <div className="relative z-10 flex items-end gap-3 sm:gap-6 -mt-12">
                <div className="relative">
                  <Avatar
                    src={displayUser?.avatar}
                    alt={displayUser?.username || 'User'}
                    userId={String(displayUser?.id)}
                    size="xl"
                    className="border-4 border-card glow"
                  />
                  {isOwnProfile && (
                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-brand text-primary-foreground flex items-center justify-center cursor-pointer hover:brightness-110 transition-all shadow-glow">
                      <Upload className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={loading}
                      />
                    </label>
                  )}
                </div>

                <div className="flex-1 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-3 sm:gap-0">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold drop-shadow-md">
                          {displayUser?.username}
                        </h1>
                        <PremiumBadge
                          planName={isOwnProfile ? user?.premium?.plan_name : premiumInfo?.plan_name}
                          tier={isOwnProfile ? user?.premium?.tier : undefined}
                          active={isOwnProfile ? !!user?.premium?.active : hasPremium}
                        />
                      </div>
                      <p className="text-muted-foreground">@{displayUser?.username}</p>
                    </div>
                    {isOwnProfile && !isEditing && (
                      <Button onClick={() => setIsEditing(true)} className="px-3 sm:px-4 text-sm whitespace-nowrap">
                        <Edit className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden xs:inline">Edit Profile</span>
                        <span className="xs:hidden">Edit</span>
                      </Button>
                    )}
                    {isOwnProfile && isEditing && (
                      <div className="flex gap-2">
                        <Button onClick={handleSave} loading={loading}>
                          <Save className="w-4 h-4" />
                          Save
                        </Button>
                        <Button variant="secondary" onClick={handleCancel}>
                          <X className="w-4 h-4" />
                          Cancel
                        </Button>
                      </div>
                    )}
                    {!isOwnProfile && (
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="secondary"
                          onClick={() => navigate(`/support/${userId}`)}
                        >
                          <Heart className="w-4 h-4" />
                          <span className="hidden sm:inline">Поддержать</span>
                        </Button>
                        {isSubscribed ? (
                          <Button 
                            variant="secondary" 
                            onClick={handleUnsubscribe}
                            loading={subscribeLoading}
                          >
                            <UserMinus className="w-4 h-4" />
                            <span className="hidden sm:inline">Unsubscribe</span>
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleSubscribe}
                            loading={subscribeLoading}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Subscribe</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {formatDate(displayUser?.created_at || new Date())}
                  </p>
                  
                  {!isOwnProfile && (
                    <div className="flex flex-wrap gap-3 sm:gap-4 mt-3">
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{followersCount}</span>
                        <span className="text-muted-foreground">followers</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="font-semibold">{followingCount}</span>
                        <span className="text-muted-foreground">following</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Lite mode quick actions */}
        {liteMode && isOwnProfile && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Link href="/invite">
              <Card className="glass rounded-xl shadow-soft cursor-pointer hover:bg-accent/10 transition-colors">
                <CardContent className="flex items-center gap-3 py-4">
                  <Share2 className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-medium">{t('nav.invite')}</p>
                    <p className="text-sm text-muted-foreground">{t('channels.inviteFriends')}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/premium">
              <Card className="glass rounded-xl shadow-soft cursor-pointer hover:bg-accent/10 transition-colors">
                <CardContent className="flex items-center gap-3 py-4">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  <div>
                    <p className="font-medium">{t('nav.premium')}</p>
                    <p className="text-sm text-muted-foreground">
                      {hasPremium ? premiumInfo?.plan_name : t('premium.upgrade')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="glass rounded-xl shadow-soft">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <Input
                      label="Display Name"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Your display name"
                      maxLength={50}
                    />
                    <Textarea
                      label="Bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={500}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isOwnProfile && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Display Name</p>
                        <p className="font-medium">{user?.alias || 'Not set'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Bio</p>
                      <p className="whitespace-pre-wrap">
                        {displayUser?.bio || 'No bio yet'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass rounded-xl shadow-soft">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="glass rounded-xl shadow-soft">
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Followers</p>
                  <p className="text-2xl font-bold gradient-brand-text">{followersCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Following</p>
                  <p className="text-2xl font-bold gradient-brand-text">{followingCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Friends</p>
                  <p className="text-2xl font-bold gradient-brand-text">{friendsCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Posts</p>
                  <p className="text-2xl font-bold gradient-brand-text">{postsCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass rounded-xl shadow-soft">
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No badges yet
                </div>
              </CardContent>
            </Card>

            {isOwnProfile && <TelegramLink isOwnProfile={isOwnProfile} />}
            {isOwnProfile && <MaxLink isOwnProfile={isOwnProfile} />}
          </div>
        </div>
      </div>
    </Layout>
  )
}
