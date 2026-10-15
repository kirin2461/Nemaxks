import React, { useState, useEffect } from 'react'
import { useParams, useLocation } from 'wouter'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Input, Textarea } from '@/components/Input'
import { useStore } from '@/lib/store'
import { userAPI, premiumAPI } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { Heart, Crown, Sparkles, Check, ArrowLeft } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

interface PremiumPlan {
  id: number
  slug: string
  name: string
  description: string
  price_rub: number
  features: string
  is_active: boolean
}

export default function SupportPage() {
  const { userId } = useParams<{ userId: string }>()
  const [, navigate] = useLocation()
  const { user } = useStore()
  const toast = useToast()

  const [creator, setCreator] = useState<any>(null)
  const [plans, setPlans] = useState<PremiumPlan[]>([])
  const [donations, setDonations] = useState<any[]>([])
  const [totalDonations, setTotalDonations] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selectedAmount, setSelectedAmount] = useState<number | null>(100)
  const [customAmount, setCustomAmount] = useState('')
  const [donationMessage, setDonationMessage] = useState('')
  const [donating, setDonating] = useState(false)

  const predefinedAmounts = [50, 100, 250, 500, 1000]

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [profileData, plansData, donationsData] = await Promise.all([
        userAPI.getProfile(userId!),
        premiumAPI.getPlans(),
        userAPI.getDonations(userId!),
      ])
      setCreator(profileData)
      setPlans(plansData)
      setDonations(donationsData.donations || [])
      setTotalDonations(donationsData.total || 0)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDonate = async () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount
    if (!amount || amount < 10) {
      toast.warning('Минимальная сумма доната: 10₽')
      return
    }

    try {
      setDonating(true)
      await userAPI.createDonation(userId!, {
        amount,
        message: donationMessage,
      })
      toast.success('Донат создан!', 'Перенаправление на оплату...')
      setDonationMessage('')
      setCustomAmount('')
      loadData()
    } catch (error) {
      console.error('Failed to donate:', error)
      toast.error('Ошибка при создании доната')
    } finally {
      setDonating(false)
    }
  }

  const parseFeatures = (featuresStr: string): string[] => {
    try {
      return JSON.parse(featuresStr)
    } catch {
      return featuresStr ? featuresStr.split(',').map(f => f.trim()) : []
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto space-y-6">
          <div className="skeleton h-6 w-40" />
          <div className="flex items-center gap-4">
            <div className="skeleton h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-7 w-64" />
              <div className="skeleton h-4 w-80" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="skeleton h-96 rounded-xl" />
            <div className="skeleton h-96 rounded-xl" />
          </div>
        </div>
      </Layout>
    )
  }

  if (!creator) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full py-16 px-6 animate-rise-in">
          <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center">
            <Heart className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-semibold text-foreground mt-4">Пользователь не найден</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-rise-in">
        <button
          onClick={() => navigate(`/profile/${userId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors duration-150 text-sm"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          Назад к профилю
        </button>

        <div className="flex items-center gap-4 mb-8">
          <Avatar
            src={creator.avatar}
            alt={creator.username}
            userId={String(creator.id)}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900 tracking-[-0.015em]">
              Поддержать <span className="text-primary">{creator.username}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Помогите создателю продолжать делать контент
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  Отправить донат
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Выберите сумму:</p>
                  <div className="grid grid-cols-5 gap-2">
                    {predefinedAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setSelectedAmount(amount)
                          setCustomAmount('')
                        }}
                        className={cn(
                          'h-10 px-3 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          selectedAmount === amount && !customAmount
                            ? 'bg-primary text-primary-foreground shadow-soft'
                            : 'bg-secondary text-secondary-foreground hover:bg-graphite-200'
                        )}
                      >
                        {amount}₽
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Input
                    label="Своя сумма"
                    type="number"
                    placeholder="Введите сумму..."
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value)
                      setSelectedAmount(null)
                    }}
                    min={10}
                  />
                </div>

                <Textarea
                  label="Сообщение (необязательно)"
                  placeholder="Напишите сообщение создателю..."
                  value={donationMessage}
                  onChange={(e) => setDonationMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                />

                <Button
                  onClick={handleDonate}
                  loading={donating}
                  className="w-full"
                  disabled={!selectedAmount && !customAmount}
                >
                  <Heart className="w-4 h-4" strokeWidth={1.75} />
                  Поддержать на {customAmount || selectedAmount || 0}₽
                </Button>

                <p className="text-xs text-graphite-400 text-center">
                  Платёж обрабатывается через YooKassa
                </p>
              </CardContent>
            </Card>

            {donations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Последние донаты ({totalDonations.toFixed(0)}₽ всего)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {donations.slice(0, 5).map((donation, i) => (
                      <div
                        key={donation.id}
                        className="flex items-start justify-between gap-3 p-3 bg-secondary rounded-lg animate-rise-in"
                        style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">{donation.amount_rub}₽</p>
                          {donation.message && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {donation.message}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(donation.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  Премиум подписка
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plans.length === 0 ? (
                  <div className="text-center py-8 animate-rise-in">
                    <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto mb-3">
                      <Sparkles className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Премиум планы скоро появятся
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-4 border border-border bg-card rounded-xl hover:border-graphite-300 hover:shadow-elev transition-all duration-150"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                          <span className="text-xl font-display font-extrabold text-graphite-900">
                            {plan.price_rub}₽<span className="text-sm font-normal text-muted-foreground">/мес</span>
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {plan.description}
                        </p>
                        <ul className="space-y-1.5 mb-4">
                          {parseFeatures(plan.features).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.75} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button className="w-full">
                          Оформить подписку
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Зачем поддерживать?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Ваша поддержка помогает создателям продолжать делать качественный контент.
                </p>
                <p>
                  Донаты и подписки — это прямой способ сказать "спасибо" за их труд.
                </p>
                <p>
                  100% донатов (за вычетом комиссии платёжной системы) идёт создателю.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
