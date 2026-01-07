import React, { useState } from 'react'
import { useParams } from 'wouter'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Input, Textarea } from '@/components/Input'
import { TelegramLink } from '@/components/TelegramLink'
import { useStore } from '@/lib/store'
import { userAPI } from '@/lib/api'
import { Edit, Save, X, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>()
  const { user, updateProfile } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edit form state
  const [alias, setAlias] = useState(user?.alias || '')
  const [bio, setBio] = useState(user?.bio || '')

  const isOwnProfile = !userId || userId === user?.id

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
      // Refresh user data
      window.location.reload()
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="cosmic-border mb-6">
          <div className="relative">
            {/* Cover background */}
            <div className="h-32 cosmic-gradient rounded-t-lg" />

            {/* Profile info */}
            <div className="px-6 pb-6">
              <div className="flex items-end gap-6 -mt-12">
                {/* Avatar */}
                <div className="relative">
                  <Avatar
                    src={user?.avatar}
                    alt={user?.username || 'User'}
                    userId={user?.id}
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

                {/* User info */}
                <div className="flex-1 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h1 className="text-2xl font-bold">
                        {user?.alias || user?.username}
                      </h1>
                      <p className="text-muted-foreground">@{user?.username}</p>
                    </div>
                    {isOwnProfile && !isEditing && (
                      <Button onClick={() => setIsEditing(true)}>
                        <Edit className="w-4 h-4" />
                        Edit Profile
                      </Button>
                    )}
                    {isEditing && (
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
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {formatDate(user?.created_at || new Date())}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main info */}
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
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Display Name</p>
                      <p className="font-medium">{user?.alias || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Bio</p>
                      <p className="whitespace-pre-wrap">
                        {user?.bio || 'No bio yet'}
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

          {/* Stats sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Messages</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Friends</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Channels</p>
                  <p className="text-2xl font-bold">0</p>
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

            <TelegramLink isOwnProfile={isOwnProfile} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
