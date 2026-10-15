import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shopAPI, currencyAPI, inventoryAPI, ShopItem, VirtualCurrency, UserInventory } from '../lib/api';
import { Coins, Gem, ShoppingBag, Check, Palette, Frame, Image, Sparkles } from 'lucide-react';

/* Rarity encoded by border weight + graphite→emerald scale (NO rainbow gradients) */
const rarityBorders: Record<string, string> = {
  common: 'border border-border',
  uncommon: 'border border-graphite-300',
  rare: 'border-2 border-graphite-400',
  epic: 'border-2 border-emerald-300',
  legendary: 'border-2 border-emerald-600 shadow-lg-brand',
};

const rarityBadges: Record<string, string> = {
  common: 'bg-secondary text-secondary-foreground',
  uncommon: 'bg-secondary text-secondary-foreground',
  rare: 'border border-graphite-300 text-graphite-600',
  epic: 'bg-emerald-100 text-emerald-800',
  legendary: 'bg-emerald-600 text-white',
};

const categoryIcons: Record<string, React.ReactNode> = {
  themes: <Palette className="w-4 h-4" strokeWidth={1.75} />,
  frames: <Frame className="w-4 h-4" strokeWidth={1.75} />,
  banners: <Image className="w-4 h-4" strokeWidth={1.75} />,
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
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-48 rounded-lg" />
          <div className="skeleton h-10 w-96 max-w-full rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto animate-rise-in">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            <h1 className="text-2xl font-display font-bold text-graphite-900">{t('shop.title')}</h1>
          </div>

          {currency && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                <Coins className="w-4 h-4 text-graphite-600 shrink-0" strokeWidth={1.75} />
                <span className="font-mono">{currency.coins}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
                <Gem className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="font-mono">{currency.gems}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`h-8 px-3 rounded-md text-sm whitespace-nowrap transition-all duration-150 flex items-center gap-2 ${
                  activeCategory === cat
                    ? 'bg-card text-foreground shadow-soft font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {categoryIcons[cat]}
                {t(`shop.categories.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" key={activeCategory}>
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`group relative rounded-xl bg-card shadow-soft overflow-hidden transition-all duration-150 animate-rise-in hover:-translate-y-0.5 hover:shadow-elev ${
                rarityBorders[item.rarity] || rarityBorders.common
              }`}
              style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
            >
              <div className={`absolute top-2 right-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${rarityBadges[item.rarity] || rarityBadges.common}`}>
                {item.rarity}
              </div>

              <div className="aspect-square max-h-48 bg-graphite-100 grid place-items-center">
                <Sparkles className="w-12 h-12 text-graphite-400 transition-all duration-150 group-hover:text-emerald-600 group-hover:scale-110" strokeWidth={1.5} />
              </div>

              <div className="p-4">
                <h3 className="text-sm font-semibold text-graphite-900 mb-1">{item.name_ru || item.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{item.description_ru || item.description}</p>

                {isOwned(item.id) ? (
                  isEquipped(item.id) ? (
                    <div className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                      {t('shop.equipped')}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEquip(item.id)}
                      className="w-full h-9 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 active:scale-[0.97]"
                    >
                      {t('shop.equip')}
                    </button>
                  )
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePurchase(item, 'coins')}
                      disabled={!currency || currency.coins < item.price_coins || purchasing === item.id}
                      className="flex-1 h-9 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-graphite-200 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Coins className="w-4 h-4 text-graphite-600" strokeWidth={1.75} />
                      <span className="font-display font-bold">{item.price_coins}</span>
                    </button>
                    {item.price_gems > 0 && (
                      <button
                        onClick={() => handlePurchase(item, 'gems')}
                        disabled={!currency || currency.gems < item.price_gems || purchasing === item.id}
                        className="flex-1 h-9 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] flex items-center justify-center gap-1.5 bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Gem className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-display font-bold">{item.price_gems}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <ShoppingBag className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground mt-4 max-w-[320px] mx-auto">{t('shop.noItems', 'Нет товаров в этой категории')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
