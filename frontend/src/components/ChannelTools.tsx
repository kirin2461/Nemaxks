'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Grid3x3 } from 'lucide-react';

export interface ChannelToolItem {
  id: string;
  name: string;
  type: 'board' | 'notebook';
  description?: string;
  ownerRole: 'admin' | 'moderator' | 'member';
  visibleTo: string[]; // roles that can view
  editableBy: string[]; // roles that can edit
  createdAt: string;
  updatedAt: string;
}

export interface ChannelToolsProps {
  channelId: string;
  items: ChannelToolItem[];
  userRole: string;
  onCreateBoard?: () => void;
  onCreateNotebook?: () => void;
  onSelectItem?: (item: ChannelToolItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onUpdatePermissions?: (itemId: string, visibleTo: string[], editableBy: string[]) => void;
}

const ChannelTools: React.FC<ChannelToolsProps> = ({
  channelId,
  items,
  userRole,
  onCreateBoard,
  onCreateNotebook,
  onSelectItem,
  onDeleteItem,
  onUpdatePermissions,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const canViewItem = (item: ChannelToolItem): boolean => {
    return (
      item.visibleTo.includes(userRole) ||
      item.visibleTo.includes('all') ||
      item.ownerRole === userRole
    );
  };

  const canEditItem = (item: ChannelToolItem): boolean => {
    return (
      item.editableBy.includes(userRole) ||
      item.editableBy.includes('all') ||
      item.ownerRole === userRole
    );
  };

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemClick = (item: ChannelToolItem) => {
    if (canViewItem(item)) {
      setSelectedItem(item.id);
      onSelectItem?.(item);
    }
  };

  const visibleItems = items.filter(item => canViewItem(item));
  const boardItems = visibleItems.filter(item => item.type === 'board');
  const notebookItems = visibleItems.filter(item => item.type === 'notebook');

  return (
    <div className="channel-tools-container w-full bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">Channel Tools</h2>
        <div className="flex gap-2">
          {userRole !== 'member' && (
            <>
              <button
                onClick={onCreateBoard}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                <Grid3x3 size={16} />
                Board
              </button>
              <button
                onClick={onCreateNotebook}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition"
              >
                <FileText size={16} />
                Notebook
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Boards Section */}
        {boardItems.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => toggleExpand('boards')}
              className="flex items-center gap-2 w-full p-2 hover:bg-gray-100 rounded font-medium text-gray-700"
            >
              {expandedItems.has('boards') ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
              <Grid3x3 size={18} className="text-blue-500" />
              Boards ({boardItems.length})
            </button>
            {expandedItems.has('boards') && (
              <div className="ml-4 mt-2 space-y-2">
                {boardItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3 rounded border cursor-pointer transition ${
                      selectedItem === item.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{item.name}</h4>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 text-xs text-gray-500">
                          <span>Owner: {item.ownerRole}</span>
                          <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {canEditItem(item) && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteItem?.(item.id);
                          }}
                          className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notebooks Section */}
        {notebookItems.length > 0 && (
          <div>
            <button
              onClick={() => toggleExpand('notebooks')}
              className="flex items-center gap-2 w-full p-2 hover:bg-gray-100 rounded font-medium text-gray-700"
            >
              {expandedItems.has('notebooks') ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
              <FileText size={18} className="text-purple-500" />
              Notebooks ({notebookItems.length})
            </button>
            {expandedItems.has('notebooks') && (
              <div className="ml-4 mt-2 space-y-2">
                {notebookItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3 rounded border cursor-pointer transition ${
                      selectedItem === item.id
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-white border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{item.name}</h4>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 text-xs text-gray-500">
                          <span>Owner: {item.ownerRole}</span>
                          <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {canEditItem(item) && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteItem?.(item.id);
                          }}
                          className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {visibleItems.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No tools available for this channel yet.</p>
            {userRole !== 'member' && (
              <p className="text-sm text-gray-400 mt-2">Create boards or notebooks to get started.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelTools;
