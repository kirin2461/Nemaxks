import { useState, useEffect } from 'react';
import { profileCustomizationAPI, badgesAPI, inventoryAPI, UserProfileCustomization, UserInventory, UserBadge, Badge } from '../lib/api';
import { User, Frame, Image, Award, Settings, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const rarityColors: Record<string, string> = {
  common: 'text-graphite-500',
  uncommon: 'text-emerald-600',
  rare: 'text-emerald-700',
  epic: 'text-primary',
  legendary: 'text-warning',
};

/* Accent picker swatches — emerald scale (design.md §1.2) + graphite */
const ACCENT_SWATCHES = [
  { value: '#34d399', label: 'Emerald 400' },
  { value: '#10b981', label: 'Emerald 500' },
  { value: '#059669', label: 'Emerald 600' },
  { value: '#047857', label: 'Emerald 700' },
  { value: '#065f46', label: 'Emerald 800' },
  { value: '#064e3b', label: 'Emerald 900' },
  { value: '#3a4152', label: 'Graphite' },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-graphite-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-soft',
          'transition-transform duration-150 ease-out-expo',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export default function ProfileCustomizationPage() {
  const [profile, setProfile] = useState<UserProfileCustomization | null>(null);
  const [equippedItems, setEquippedItems] = useState<UserInventory[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [activeTab, setActiveTab] = useState<'frames' | 'banners' | 'badges' | 'settings'>('frames');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [profileColor, setProfileColor] = useState('#047857');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileData, badgesData, inventoryData] = await Promise.all([
        profileCustomizationAPI.get(),
        badgesAPI.getAll(),
        inventoryAPI.get(),
      ]);
      setProfile(profileData.profile);
      setEquippedItems(profileData.equipped_items || []);
      setUserBadges(profileData.badges || []);
      setAllBadges(badgesData || []);
      setInventory(inventoryData || []);
      setBio(profileData.profile?.bio || '');
      setProfileColor(profileData.profile?.profile_color || '#047857');
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEquip = async (itemId: number) => {
    try {
      await inventoryAPI.equip(itemId);
      await loadData();
    } catch (err) {
      console.error('Equip failed:', err);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      setSaving(true);
      await profileCustomizationAPI.update({
        bio,
        profile_color: profileColor,
        show_level: profile?.show_level,
        show_achievements: profile?.show_achievements,
        show_activity: profile?.show_activity,
      });
      await loadData();
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (field: 'show_level' | 'show_achievements' | 'show_activity') => {
    if (!profile) return;
    try {
      await profileCustomizationAPI.update({
        [field]: !profile[field],
      });
      await loadData();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const getItemsByType = (type: string) => inventory.filter((i) => i.item.type === type);
  const isEquipped = (itemId: number) => equippedItems.some((i) => i.item_id === itemId);
  const hasBadge = (badgeId: number) => userBadges.some((b) => b.badge_id === badgeId);

  const tabs = [
    { id: 'frames', label: 'Рамки', icon: <Frame className="w-4 h-4" strokeWidth={1.75} /> },
    { id: 'banners', label: 'Баннеры', icon: <Image className="w-4 h-4" strokeWidth={1.75} /> },
    { id: 'badges', label: 'Значки', icon: <Award className="w-4 h-4" strokeWidth={1.75} /> },
    { id: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" strokeWidth={1.75} /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="skeleton h-9 w-64" />
          <div className="skeleton h-10 w-96 rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <User className="w-7 h-7 text-primary" strokeWidth={1.75} />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-graphite-900 tracking-[-0.015em]">
            Кастомизация профиля
          </h1>
        </div>

        {/* Segmented tabs (design.md §6.12) */}
        <div className="inline-flex p-1 rounded-lg bg-secondary gap-1 mb-6 max-w-full overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'h-8 px-3 rounded-md text-sm flex items-center gap-2 whitespace-nowrap transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-soft font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'frames' || activeTab === 'banners') && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {getItemsByType(activeTab === 'frames' ? 'frame' : 'banner').map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
                className={cn(
                  'bg-card rounded-xl p-4 border cursor-pointer transition-all duration-150 shadow-soft',
                  'hover:-translate-y-0.5 hover:shadow-elev',
                  isEquipped(inv.item_id)
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-graphite-300'
                )}
                onClick={() => !isEquipped(inv.item_id) && handleEquip(inv.item_id)}
              >
                <div className="h-20 bg-graphite-100 rounded-lg mb-3 flex items-center justify-center">
                  {activeTab === 'frames' && <Frame className="w-8 h-8 text-graphite-400" strokeWidth={1.5} />}
                  {activeTab === 'banners' && <Image className="w-8 h-8 text-graphite-400" strokeWidth={1.5} />}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{inv.item.name_ru || inv.item.name}</p>
                    <p className={cn('text-xs capitalize', rarityColors[inv.item.rarity])}>{inv.item.rarity}</p>
                  </div>
                  {isEquipped(inv.item_id) && (
                    <Check className="w-5 h-5 text-primary shrink-0 animate-pop-menu" />
                  )}
                </div>
              </motion.div>
            ))}
            {getItemsByType(activeTab === 'frames' ? 'frame' : 'banner').length === 0 && (
              <div className="col-span-full text-center py-16 px-6 animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  {activeTab === 'frames'
                    ? <Frame className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    : <Image className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />}
                </div>
                <p className="text-lg font-semibold text-foreground mt-4">Нет предметов</p>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto mt-1">
                  Нет предметов. Посетите магазин!
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allBadges.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
                className={cn(
                  'bg-card rounded-xl p-4 border text-center shadow-soft transition-all duration-150',
                  hasBadge(badge.id) ? 'border-primary' : 'border-border opacity-60'
                )}
              >
                <div className={cn(
                  'w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center',
                  hasBadge(badge.id) ? 'bg-accent' : 'bg-secondary'
                )}>
                  <Award className={cn('w-6 h-6', hasBadge(badge.id) ? rarityColors[badge.rarity] : 'text-graphite-400')} strokeWidth={1.75} />
                </div>
                <p className="font-medium text-foreground text-sm">{badge.name_ru || badge.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.description_ru || badge.description}</p>
                <p className={cn('text-xs mt-2 capitalize', rarityColors[badge.rarity])}>{badge.rarity}</p>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden animate-rise-in">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Настройки профиля</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Описание, акцентный цвет и видимость</p>
            </div>

            <div className="px-5 py-4 border-b border-border">
              <label className="block text-sm font-medium text-foreground mb-1.5">О себе</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input-field resize-none min-h-[96px] py-2"
                rows={3}
                placeholder="Расскажите о себе..."
              />
            </div>

            <div className="px-5 py-4 border-b border-border">
              <label className="block text-sm font-medium text-foreground mb-3">Цвет профиля</label>
              <div className="flex flex-wrap items-center gap-2.5">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    onClick={() => setProfileColor(swatch.value)}
                    className={cn(
                      'h-9 w-9 rounded-full transition-all duration-150 animate-pop-menu',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      profileColor.toLowerCase() === swatch.value.toLowerCase()
                        ? 'ring-2 ring-offset-2 ring-primary ring-offset-card scale-110'
                        : 'ring-1 ring-border hover:scale-105'
                    )}
                    style={{ backgroundColor: swatch.value }}
                  />
                ))}
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="color"
                    value={profileColor}
                    onChange={(e) => setProfileColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-input cursor-pointer bg-card p-0.5"
                  />
                  <input
                    type="text"
                    value={profileColor}
                    onChange={(e) => setProfileColor(e.target.value)}
                    className="input-field w-28 font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {profile?.show_level
                    ? <Eye className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    : <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />}
                  <span className="text-sm text-foreground">Показывать уровень</span>
                </div>
                <Toggle checked={!!profile?.show_level} onChange={() => handleToggle('show_level')} />
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {profile?.show_achievements
                    ? <Eye className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    : <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />}
                  <span className="text-sm text-foreground">Показывать достижения</span>
                </div>
                <Toggle checked={!!profile?.show_achievements} onChange={() => handleToggle('show_achievements')} />
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-2 min-w-0">
                  {profile?.show_activity
                    ? <Eye className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    : <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />}
                  <span className="text-sm text-foreground">Показывать активность</span>
                </div>
                <Toggle checked={!!profile?.show_activity} onChange={() => handleToggle('show_activity')} />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border bg-background/50">
              <button
                onClick={handleUpdateSettings}
                disabled={saving}
                className={cn(
                  'w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium',
                  'bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand',
                  'transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить изменения
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
