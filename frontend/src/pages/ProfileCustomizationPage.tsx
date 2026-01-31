import { useState, useEffect } from 'react';
import { profileCustomizationAPI, badgesAPI, inventoryAPI, UserProfileCustomization, UserInventory, UserBadge, Badge } from '../lib/api';
import { User, Palette, Frame, Image, Award, Settings, Check, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const rarityColors: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
};

export default function ProfileCustomizationPage() {
  const [profile, setProfile] = useState<UserProfileCustomization | null>(null);
  const [equippedItems, setEquippedItems] = useState<UserInventory[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [activeTab, setActiveTab] = useState<'themes' | 'frames' | 'banners' | 'badges' | 'settings'>('themes');
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [profileColor, setProfileColor] = useState('#8b5cf6');

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
      setProfileColor(profileData.profile?.profile_color || '#8b5cf6');
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
    { id: 'themes', label: 'Темы', icon: <Palette className="w-4 h-4" /> },
    { id: 'frames', label: 'Рамки', icon: <Frame className="w-4 h-4" /> },
    { id: 'banners', label: 'Баннеры', icon: <Image className="w-4 h-4" /> },
    { id: 'badges', label: 'Значки', icon: <Award className="w-4 h-4" /> },
    { id: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <User className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Кастомизация профиля</h1>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'themes' || activeTab === 'frames' || activeTab === 'banners') && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {getItemsByType(activeTab === 'themes' ? 'theme' : activeTab === 'frames' ? 'frame' : 'banner').map((inv) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-gray-800/50 rounded-xl p-4 border cursor-pointer transition-all ${
                  isEquipped(inv.item_id) ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => !isEquipped(inv.item_id) && handleEquip(inv.item_id)}
              >
                <div className="h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
                  {activeTab === 'themes' && <Palette className="w-8 h-8 text-gray-500" />}
                  {activeTab === 'frames' && <Frame className="w-8 h-8 text-gray-500" />}
                  {activeTab === 'banners' && <Image className="w-8 h-8 text-gray-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">{inv.item.name_ru || inv.item.name}</p>
                    <p className={`text-xs capitalize ${rarityColors[inv.item.rarity]}`}>{inv.item.rarity}</p>
                  </div>
                  {isEquipped(inv.item_id) && (
                    <Check className="w-5 h-5 text-purple-400" />
                  )}
                </div>
              </motion.div>
            ))}
            {getItemsByType(activeTab === 'themes' ? 'theme' : activeTab === 'frames' ? 'frame' : 'banner').length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400">Нет предметов. Посетите магазин!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allBadges.map((badge) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-gray-800/50 rounded-xl p-4 border text-center ${
                  hasBadge(badge.id) ? 'border-purple-500' : 'border-gray-700 opacity-50'
                }`}
              >
                <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-2xl ${
                  hasBadge(badge.id) ? 'bg-purple-500/20' : 'bg-gray-700'
                }`}>
                  <Award className={`w-6 h-6 ${hasBadge(badge.id) ? rarityColors[badge.rarity] : 'text-gray-500'}`} />
                </div>
                <p className="font-medium text-white text-sm">{badge.name_ru || badge.name}</p>
                <p className="text-xs text-gray-400 mt-1">{badge.description_ru || badge.description}</p>
                <p className={`text-xs mt-2 capitalize ${rarityColors[badge.rarity]}`}>{badge.rarity}</p>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">О себе</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none"
                rows={3}
                placeholder="Расскажите о себе..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Цвет профиля</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={profileColor}
                  onChange={(e) => setProfileColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border-0 cursor-pointer"
                />
                <span className="text-gray-400">{profileColor}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Видимость</h4>
              
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {profile?.show_level ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  <span className="text-white">Показывать уровень</span>
                </div>
                <button
                  onClick={() => handleToggle('show_level')}
                  className={`w-12 h-6 rounded-full transition-all ${
                    profile?.show_level ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    profile?.show_level ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {profile?.show_achievements ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  <span className="text-white">Показывать достижения</span>
                </div>
                <button
                  onClick={() => handleToggle('show_achievements')}
                  className={`w-12 h-6 rounded-full transition-all ${
                    profile?.show_achievements ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    profile?.show_achievements ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {profile?.show_activity ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  <span className="text-white">Показывать активность</span>
                </div>
                <button
                  onClick={() => handleToggle('show_activity')}
                  className={`w-12 h-6 rounded-full transition-all ${
                    profile?.show_activity ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    profile?.show_activity ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <button
              onClick={handleUpdateSettings}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-all"
            >
              Сохранить изменения
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
