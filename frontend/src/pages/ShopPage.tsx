import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shopAPI, currencyAPI, inventoryAPI, ShopItem, VirtualCurrency, UserInventory } from '../lib/api';
import { Coins, Gem, ShoppingBag, Check, Palette, Frame, Image, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const rarityColors: Record<string, string> = {
  common: 'border-gray-500 bg-gray-500/10',
  uncommon: 'border-green-500 bg-green-500/10',
  rare: 'border-blue-500 bg-blue-500/10',
  epic: 'border-purple-500 bg-purple-500/10',
  legendary: 'border-yellow-500 bg-yellow-500/10',
};

const categoryIcons: Record<string, React.ReactNode> = {
  themes: <Palette className="w-5 h-5" />,
  frames: <Frame className="w-5 h-5" />,
  banners: <Image className="w-5 h-5" />,
};

export default function ShopPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<VirtualCurrency | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  const categories = ['all', 'themes', 'frames', 'banners'];

  useEffect(() => {
    loadData();
  }, [activeCategory]);

  const loadData = async () => {
    try {
      const [currencyData, itemsData, inventoryData] = await Promise.all([
        currencyAPI.get(),
        shopAPI.getItems(activeCategory === 'all' ? undefined : activeCategory),
        inventoryAPI.get(),
      ]);
      setCurrency(currencyData);
      setItems(itemsData || []);
      setInventory(inventoryData || []);
    } catch (err) {
      console.error('Failed to load shop data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (item: ShopItem, payWith: 'coins' | 'gems') => {
    if (purchasing) return;
    setPurchasing(item.id);
    try {
      const result = await shopAPI.purchase(item.id, payWith);
      setCurrency(result.balance);
      await loadData();
    } catch (err) {
      console.error('Purchase failed:', err);
    } finally {
      setPurchasing(null);
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

  const isOwned = (itemId: number) => inventory.some((i) => i.item_id === itemId);
  const isEquipped = (itemId: number) => inventory.some((i) => i.item_id === itemId && i.is_equipped);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('shop.title')}</h1>
          </div>
          
          {currency && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg">
                <Coins className="w-5 h-5 text-yellow-400 shrink-0" />
                <span className="text-yellow-400 font-semibold">{currency.coins}</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-lg">
                <Gem className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-purple-400 font-semibold">{currency.gems}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeCategory === cat
                  ? 'bg-purple-500 text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {categoryIcons[cat]}
              {t(`shop.categories.${cat}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`relative bg-card/50 rounded-xl border-2 p-4 ${rarityColors[item.rarity]}`}
              >
                <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium capitalize bg-black/50">
                  {item.rarity}
                </div>

                <div className="h-32 bg-gradient-to-br from-secondary to-muted rounded-lg mb-4 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-1">{item.name_ru || item.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{item.description_ru || item.description}</p>

                {isOwned(item.id) ? (
                  <button
                    onClick={() => handleEquip(item.id)}
                    disabled={isEquipped(item.id)}
                    className={`w-full py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      isEquipped(item.id)
                        ? 'bg-green-500/20 text-green-400 cursor-default'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    {isEquipped(item.id) ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('shop.equipped')}
                      </>
                    ) : (
                      t('shop.equip')
                    )}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePurchase(item, 'coins')}
                      disabled={!currency || currency.coins < item.price_coins || purchasing === item.id}
                      className="flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Coins className="w-4 h-4" />
                      {item.price_coins}
                    </button>
                    {item.price_gems > 0 && (
                      <button
                        onClick={() => handlePurchase(item, 'gems')}
                        disabled={!currency || currency.gems < item.price_gems || purchasing === item.id}
                        className="flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Gem className="w-4 h-4" />
                        {item.price_gems}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {items.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('shop.noItems', 'Нет товаров в этой категории')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
