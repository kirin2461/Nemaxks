import { useState, useEffect } from 'react'
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { getActiveBanners, type NotificationBanner } from '@/lib/api'
import { cn } from '@/lib/utils'

export function BannerDisplay() {
  const [banners, setBanners] = useState<NotificationBanner[]>([])
  const [dismissedIds, setDismissedIds] = useState<number[]>(() => {
    const stored = localStorage.getItem('dismissed_banners')
    return stored ? JSON.parse(stored) : []
  })

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await getActiveBanners()
        setBanners(response.banners || [])
      } catch (error) {
        console.error('Failed to fetch banners:', error)
      }
    }

    fetchBanners()
    const interval = setInterval(fetchBanners, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = (bannerId: number) => {
    const newDismissed = [...dismissedIds, bannerId]
    setDismissedIds(newDismissed)
    localStorage.setItem('dismissed_banners', JSON.stringify(newDismissed))
  }

  const visibleBanners = banners.filter(b => !dismissedIds.includes(b.id))

  if (visibleBanners.length === 0) return null

  return (
    <div className="space-y-2">
      {visibleBanners.map(banner => (
        <div
          key={banner.id}
          className={cn(
            "relative px-4 py-3 flex items-start gap-3 animate-fade-in",
            banner.type === 'info' && "bg-blue-500/10 text-blue-400 border-b border-blue-500/20",
            banner.type === 'success' && "bg-green-500/10 text-green-400 border-b border-green-500/20",
            banner.type === 'warning' && "bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20",
            banner.type === 'error' && "bg-red-500/10 text-red-400 border-b border-red-500/20"
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {banner.type === 'info' && <Info className="w-5 h-5" />}
            {banner.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {banner.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {banner.type === 'error' && <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{banner.title}</p>
            <p className="text-sm opacity-80">{banner.message}</p>
          </div>
          <button
            onClick={() => handleDismiss(banner.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
