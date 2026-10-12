import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bookmark, Plus, Folder, Lock, Globe, Trash2, FileText } from 'lucide-react';
import { collectionsAPI, Collection, CollectionItem } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">Collections</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg hover:bg-primary/80"
          >
            <Plus className="w-4 h-4" />
            New Collection
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
            {collections.map((collection: Collection) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-card rounded-xl p-5 cursor-pointer hover:bg-muted transition-colors ${
                  selectedCollection === collection.id ? 'ring-2 ring-accent/50' : ''
                }`}
                onClick={() => setSelectedCollection(collection.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{collection.icon_emoji}</span>
                    <div>
                      <h3 className="font-bold">{collection.name}</h3>
                      <p className="text-muted-foreground text-sm">{collection.item_count} items</p>
                    </div>
                  </div>
                  {collection.is_private ? (
                    <Lock className="w-4 h-4 text-accent" />
                  ) : (
                    <Globe className="w-4 h-4 text-green-400" />
                  )}
                </div>
                {collection.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2">{collection.description}</p>
                )}
              </motion.div>
            ))}

            {collections.length === 0 && (
              <div className="col-span-2 bg-card rounded-xl p-12 text-center">
                <Folder className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No collections yet</h3>
                <p className="text-muted-foreground">Create your first collection to save content</p>
              </div>
            )}
          </div>

          <div>
            {selectedCollection && collectionData ? (
              <div className="bg-card rounded-xl p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{collectionData.collection.icon_emoji}</span>
                    <h3 className="font-bold">{collectionData.collection.name}</h3>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(selectedCollection)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {collectionData.items.map((item: CollectionItem) => (
                    <div
                      key={item.id}
                      className="bg-secondary/50 rounded-lg p-3 flex items-start justify-between"
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
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {collectionData.items.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No items in collection</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-8 text-center sticky top-6">
                <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a collection to view items</p>
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-xl font-bold mb-4">Create Collection</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {emojiOptions.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-10 h-10 rounded-lg text-xl ${
                          newEmoji === emoji ? 'bg-primary' : 'bg-secondary hover:bg-muted'
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
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Private collection</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 bg-secondary rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newName || createMutation.isPending}
                    className="flex-1 py-2 bg-primary rounded-lg font-medium hover:bg-primary/80 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
