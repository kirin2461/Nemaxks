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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold">Collections</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 rounded-lg hover:bg-amber-700"
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
                className={`bg-gray-800 rounded-xl p-5 cursor-pointer hover:bg-gray-750 transition-colors ${
                  selectedCollection === collection.id ? 'ring-2 ring-amber-500' : ''
                }`}
                onClick={() => setSelectedCollection(collection.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{collection.icon_emoji}</span>
                    <div>
                      <h3 className="font-bold">{collection.name}</h3>
                      <p className="text-gray-400 text-sm">{collection.item_count} items</p>
                    </div>
                  </div>
                  {collection.is_private ? (
                    <Lock className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Globe className="w-4 h-4 text-green-400" />
                  )}
                </div>
                {collection.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">{collection.description}</p>
                )}
              </motion.div>
            ))}

            {collections.length === 0 && (
              <div className="col-span-2 bg-gray-800 rounded-xl p-12 text-center">
                <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No collections yet</h3>
                <p className="text-gray-400">Create your first collection to save content</p>
              </div>
            )}
          </div>

          <div>
            {selectedCollection && collectionData ? (
              <div className="bg-gray-800 rounded-xl p-6 sticky top-6">
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
                      className="bg-gray-700/50 rounded-lg p-3 flex items-start justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm capitalize">{item.content_type}</p>
                          {item.note && (
                            <p className="text-xs text-gray-400">{item.note}</p>
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
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {collectionData.items.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No items in collection</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center sticky top-6">
                <Folder className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a collection to view items</p>
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-xl font-bold mb-4">Create Collection</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {emojiOptions.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-10 h-10 rounded-lg text-xl ${
                          newEmoji === emoji ? 'bg-amber-600' : 'bg-gray-700 hover:bg-gray-600'
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
                    className="flex-1 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newName || createMutation.isPending}
                    className="flex-1 py-2 bg-amber-600 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
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
