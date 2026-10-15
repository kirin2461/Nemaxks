import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Plus, Folder, Lock, Globe, Trash2, FileText } from 'lucide-react';
import { collectionsAPI, Collection, CollectionItem } from '../lib/api';

export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('📁');
  const [newPrivate, setNewPrivate] = useState(false);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsAPI.getAll(),
  });

  const { data: collectionData } = useQuery({
    queryKey: ['collection-items', selectedCollection],
    queryFn: () => collectionsAPI.getItems(selectedCollection!),
    enabled: !!selectedCollection,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      collectionsAPI.create({
        name: newName,
        description: newDesc,
        icon_emoji: newEmoji,
        is_private: newPrivate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => collectionsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setSelectedCollection(null);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: number; itemId: number }) =>
      collectionsAPI.removeItem(collectionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-items', selectedCollection] });
    },
  });

  const emojiOptions = ['📁', '❤️', '⭐', '🎮', '📚', '🎵', '🎬', '💡', '🔖', '📌'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-6 py-6">
        <div className="max-w-[1440px] mx-auto">
          <div className="skeleton h-9 w-48 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
                <div className="skeleton aspect-[4/3] rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-6 animate-rise-in">
      <div className="max-w-[1440px] mx-auto">
        <div className="flex items-center justify-between pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            <h1 className="text-2xl font-display font-bold tracking-tight text-graphite-900">Коллекции</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 ease-standard"
          >
            <Plus className="w-4 h-4" />
            Новая коллекция
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
            {collections.map((collection: Collection, index: number) => (
              <div
                key={collection.id}
                className={`rounded-xl border bg-card shadow-soft p-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 animate-rise-in ${
                  selectedCollection === collection.id ? 'border-emerald-300 ring-2 ring-emerald-600/20' : 'border-border'
                }`}
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                onClick={() => setSelectedCollection(collection.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{collection.icon_emoji}</span>
                    <div>
                      <h3 className="text-base font-semibold">{collection.name}</h3>
                      <p className="text-xs text-muted-foreground">{collection.item_count} элементов</p>
                    </div>
                  </div>
                  {collection.is_private ? (
                    <Lock className="w-4 h-4 text-graphite-500" />
                  ) : (
                    <Globe className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                {collection.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2">{collection.description}</p>
                )}
              </div>
            ))}

            {collections.length === 0 && (
              <div className="col-span-2 rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <Folder className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4 mb-1">Сохраняйте посты в коллекции</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Создайте первую коллекцию, чтобы сохранять контент</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
                >
                  <Plus className="w-4 h-4" />
                  Создать коллекцию
                </button>
              </div>
            )}
          </div>

          <div>
            {selectedCollection && collectionData ? (
              <div className="rounded-xl border border-border bg-card shadow-soft p-5 sticky top-6 animate-rise-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{collectionData.collection.icon_emoji}</span>
                    <h3 className="text-base font-semibold">{collectionData.collection.name}</h3>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(selectedCollection)}
                    className="p-2 rounded-lg text-destructive hover:bg-danger-soft transition-colors duration-150"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {collectionData.items.map((item: CollectionItem) => (
                    <div
                      key={item.id}
                      className="bg-secondary/60 rounded-lg p-3 flex items-start justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm capitalize">{item.content_type}</p>
                          {item.note && (
                            <p className="text-xs text-muted-foreground">{item.note}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          removeItemMutation.mutate({
                            collectionId: selectedCollection,
                            itemId: item.id,
                          })
                        }
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors duration-150"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {collectionData.items.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">В коллекции пусто</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-input bg-card/50 p-8 text-center sticky top-6">
                <Folder className="w-12 h-12 text-graphite-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">Выберите коллекцию, чтобы увидеть элементы</p>
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
            <div
              className="rounded-2xl border border-border bg-card shadow-pop p-6 w-full max-w-md m-4 animate-scale-in"
            >
              <h3 className="text-lg font-semibold mb-4">Создать коллекцию</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Название</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Описание</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="input-field w-full resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Иконка</label>
                  <div className="flex gap-2 flex-wrap">
                    {emojiOptions.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-10 h-10 rounded-lg text-xl transition-all duration-150 ${
                          newEmoji === emoji ? 'bg-accent ring-1 ring-emerald-300' : 'bg-secondary hover:bg-graphite-200'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newPrivate}
                    onChange={e => setNewPrivate(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span className="text-sm">Приватная коллекция</span>
                </label>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="h-10 px-4 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newName || createMutation.isPending}
                    className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
                  >
                    Создать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
