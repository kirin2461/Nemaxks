import React, { useState, useEffect } from 'react'
import { useParams } from 'wouter'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Input, Textarea } from '@/components/Input'
import { TelegramLink } from '@/components/TelegramLink'
import { useStore } from '@/lib/store'
import { userAPI, UserProfile, UserStats } from '@/lib/api'
import { Edit, Save, X, Upload, UserPlus, UserMinus, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>()
  const { user, updateProfile } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [alias, setAlias] = useState(user?.alias || '')
  const [bio, setBio] = useState(user?.bio || '')

  const isOwnProfile = !userId || userId === String(user?.id)

  useEffect(() => {
    const targetId = isOwnProfile ? user?.id : userId
    if (targetId) {
      loadProfile(String(targetId))
      loadStats(String(targetId))
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

  const displayUser = isOwnProfile ? user : profileData
  const followersCount = stats?.followers_count || profileData?.followers_count || 0
  const followingCount = stats?.following_count || profileData?.following_count || 0
  const friendsCount = stats?.friends_count || 0
  const postsCount = stats?.posts_count || 0
  const isSubscribed = profileData?.is_subscribed || false

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
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="cosmic-border mb-6">
          <div className="relative">
            <div className="h-32 cosmic-gradient rounded-t-lg" />

            <div className="px-6 pb-6">
              <div className="flex items-end gap-6 -mt-12">
                <div className="relative">
                  <Avatar
                    src={displayUser?.avatar}
                    alt={displayUser?.username || 'User'}
                    userId={String(displayUser?.id)}
                    size="xl"
                    className="border-4 border-card"
                  />
                  {isOwnProfile && (
                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
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
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h1 className="text-2xl font-bold">
                        {displayUser?.username}
                      </h1>
                      <p className="text-muted-foreground">@{displayUser?.username}</p>
                    </div>
                    {isOwnProfile && !isEditing && (
                      <Button onClick={() => setIsEditing(true)}>
                        <Edit className="w-4 h-4" />
                        Edit Profile
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
                      <div>
                        {isSubscribed ? (
                          <Button 
                            variant="secondary" 
                            onClick={handleUnsubscribe}
                            loading={subscribeLoading}
                          >
                            <UserMinus className="w-4 h-4" />
                            Unsubscribe
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleSubscribe}
                            loading={subscribeLoading}
                          >
                            <UserPlus className="w-4 h-4" />
                            Subscribe
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {formatDate(displayUser?.created_at || new Date())}
                  </p>
                  
                  {!isOwnProfile && (
                    <div className="flex gap-4 mt-3">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
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

            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Followers</p>
                  <p className="text-2xl font-bold">{followersCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Following</p>
                  <p className="text-2xl font-bold">{followingCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Friends</p>
                  <p className="text-2xl font-bold">{friendsCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Posts</p>
                  <p className="text-2xl font-bold">{postsCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
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
          </div>
        </div>
      </div>
    </Layout>
  )
}
