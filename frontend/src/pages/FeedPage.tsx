import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { Stories } from "@/components/Stories";
import { MediaUpload } from "@/components/MediaUpload";
import { useStore } from "@/lib/store";
import { postsAPI, uploadAPI, ratingsAPI } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Image as ImageIcon,
  Send,
  TrendingUp,
  Hash,
  User,
  ChevronUp,
  X,
  Check,
  Video,
  Loader2,
  Trash2,
  UserPlus,
  UserMinus,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    alias?: string;
    avatar?: string;
  };
  content: string;
  media?: {
    type: "image" | "video";
    url: string;
  }[];
  tags?: string[];
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  isLiked?: boolean;
  isBookmarked?: boolean;
  created_at: string;
  averageRating?: number;
  ratingCount?: number;
  userRating?: number;
}


interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

export default function FeedPage() {
  const { user, isAuthenticated } = useStore();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "following" | "trending" | "my"
  >("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [commentModal, setCommentModal] = useState<{
    postId: string;
    open: boolean;
  }>({ postId: "", open: false });
  const [commentText, setCommentText] = useState("");
  const [shareNotification, setShareNotification] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());
  const [popularTags, setPopularTags] = useState<{ name: string; count: number }[]>([]);
  const [editModal, setEditModal] = useState<{ postId: string; content: string; open: boolean }>({ postId: "", content: "", open: false });
  const [editContent, setEditContent] = useState("");
  const [newPostsCount, setNewPostsCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const POSTS_PER_PAGE = 20;

  const normalizePost = (p: any): Post => ({
    id: (p.id || "").toString(),
    content: p.content || "",
    created_at: p.created_at || new Date().toISOString(),
    author: {
      id: (p.author?.id || p.author_id || p.user_id || "").toString(),
      username: p.author?.username || `user${p.user_id || 0}`,
      alias: p.author?.alias,
      avatar: p.author?.avatar,
    },
    reactions: {
      likes: p.reactions?.likes || p.likes || 0,
      comments: p.reactions?.comments || p.comments || 0,
      shares: p.reactions?.shares || p.shares || 0,
    },
    tags: p.tags || [],
    isLiked: p.is_liked || p.isLiked || false,
    isBookmarked: p.is_bookmarked || p.isBookmarked || false,
    averageRating: p.average_rating || p.averageRating || 0,
    ratingCount: p.rating_count || p.ratingCount || 0,
    userRating: p.user_rating || p.userRating || 0,
  });

  const loadPosts = async (filter?: string, tag?: string | null, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPosts([]);
      }
      
      const apiFilter = filter === "my" ? undefined : filter;
      const offset = append ? posts.length : 0;
      
      const data = await postsAPI.getPosts({
        filter: apiFilter,
        tag: tag || undefined,
        limit: POSTS_PER_PAGE,
        offset,
      });
      
      const normalizedData = (data.posts || []).map(normalizePost);
      
      if (append) {
        setPosts(prev => [...prev, ...normalizedData]);
      } else {
        setPosts(normalizedData);
      }
      setHasMore(data.has_more);
    } catch (err) {
      console.error("Failed to load posts:", err);
      if (!append) setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPosts(selectedFilter, selectedTag);
  }, [selectedFilter, selectedTag]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadPosts(selectedFilter, selectedTag, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, selectedFilter, selectedTag, posts.length]);

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  const clearTagFilter = () => {
    setSelectedTag(null);
  };

  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!isAuthenticated) return;
      try {
        const subs = await postsAPI.getSubscriptions();
        const subIds = new Set((subs || []).map((s: any) => {
          if (typeof s === 'object') {
            return (s.following_id || s.user_id || s.id)?.toString();
          }
          return s?.toString();
        }).filter(Boolean));
        setSubscriptions(subIds);
      } catch (error) {
        console.error("Failed to load subscriptions:", error);
      }
    };
    loadSubscriptions();
  }, [isAuthenticated]);

  useEffect(() => {
    const loadPopularTags = async () => {
      try {
        const data = await postsAPI.getPopularTags(10);
        setPopularTags(data.tags || []);
      } catch (error) {
        console.error("Failed to load popular tags:", error);
      }
    };
    loadPopularTags();
  }, []);

  useEffect(() => {
    const handleNewPost = (event: CustomEvent) => {
      const newPost = event.detail;
      if (newPost && newPost.author?.id !== user?.id?.toString()) {
        setNewPostsCount(prev => prev + 1);
      }
    };
    window.addEventListener('ws:new_post' as any, handleNewPost);
    return () => window.removeEventListener('ws:new_post' as any, handleNewPost);
  }, [user?.id]);

  useEffect(() => {
    const handleScroll = () => {
      if (feedRef.current) {
        setShowScrollTop(feedRef.current.scrollTop > 500);
      }
    };

    feedRef.current?.addEventListener("scroll", handleScroll);
    return () => feedRef.current?.removeEventListener("scroll", handleScroll);
  }, []);

  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const handleDeletePost = (postId: string) => {
    setDeletePostId(postId);
  };

  const confirmDeletePost = async () => {
    if (!deletePostId || isDeletingPost) return;
    setIsDeletingPost(true);
    try {
      await postsAPI.deletePost(deletePostId);
      setPosts((prev) => prev.filter((p) => p.id !== deletePostId));
      toast.success("Пост удалён");
    } catch (error) {
      console.error("Failed to delete post:", error);
      toast.error("Не удалось удалить пост. Попробуйте ещё раз.");
    } finally {
      setIsDeletingPost(false);
      setDeletePostId(null);
    }
  };

  const [comments, setComments] = useState<{ id: number; user_id: number; username: string; avatar?: string; content: string; created_at: string }[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const handleOpenComments = async (postId: string) => {
    setCommentModal({ postId, open: true });
    setCommentText("");
    setLoadingComments(true);
    try {
      const postComments = await postsAPI.getComments(postId);
      setComments(postComments || []);
    } catch (error) {
      console.error("Failed to load comments:", error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCloseComments = () => {
    setCommentModal({ postId: "", open: false });
    setCommentText("");
    setComments([]);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    try {
      const newComment = await postsAPI.addComment(commentModal.postId, commentText);
      setComments([...comments, {
        id: newComment.id,
        user_id: typeof user?.id === 'string' ? parseInt(user.id) : (user?.id || 0),
        username: user?.username || '',
        avatar: user?.avatar,
        content: commentText,
        created_at: new Date().toISOString()
      }]);
      setPosts(
        posts.map((post) =>
          post.id === commentModal.postId
            ? {
                ...post,
                reactions: {
                  ...post.reactions,
                  comments: (post.reactions?.comments ?? 0) + 1,
                },
              }
            : post,
        ),
      );
      setCommentText("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Не удалось добавить комментарий");
    }
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareNotification(true);
      setPosts(
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactions: {
                  ...post.reactions,
                  shares: (post.reactions?.shares ?? 0) + 1,
                },
              }
            : post,
        ),
      );
      setTimeout(() => setShareNotification(false), 2000);
    });
  };

  const [viewingUserStory, setViewingUserStory] = useState<string | null>(null);

  const handleViewUserStory = (userId: string) => {
    setViewingUserStory(userId);
  };

  const handleSubscribe = async (authorId: string) => {
    if (!isAuthenticated) {
      toast.warning("Войдите, чтобы подписаться");
      return;
    }
    if (authorId === user?.id?.toString()) return;

    try {
      if (subscriptions.has(authorId)) {
        await postsAPI.unsubscribe(authorId);
        setSubscriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(authorId);
          return newSet;
        });
      } else {
        await postsAPI.subscribe(authorId);
        setSubscriptions(prev => new Set(prev).add(authorId));
      }
    } catch (error) {
      console.error("Failed to toggle subscription:", error);
    }
  };

  const handleOpenEdit = (post: Post) => {
    setEditModal({ postId: post.id, content: post.content, open: true });
    setEditContent(post.content);
  };

  const handleCloseEdit = () => {
    setEditModal({ postId: "", content: "", open: false });
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await postsAPI.updatePost(editModal.postId, { content: editContent });
      setPosts(posts.map(p => 
        p.id === editModal.postId ? { ...p, content: editContent } : p
      ));
      handleCloseEdit();
    } catch (error) {
      console.error("Failed to update post:", error);
      toast.error("Не удалось обновить пост");
    }
  };

  const loadNewPosts = () => {
    setNewPostsCount(0);
    loadPosts(selectedFilter, selectedTag);
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !selectedMedia) return;

    try {
      if (!isAuthenticated) {
        throw new Error("Please login to post");
      }

      setIsUploading(true);
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | undefined;

      if (selectedMedia) {
        try {
          const uploadResult = await uploadAPI.uploadFile(
            selectedMedia.file,
            selectedMedia.type,
          );
          mediaUrl = uploadResult.url;
          mediaType = selectedMedia.type;
        } catch (uploadErr) {
          console.error("Failed to upload media:", uploadErr);
          toast.error("Не удалось загрузить медиа файл. Попробуйте ещё раз.");
          setIsUploading(false);
          return;
        }
      }

      const newPost = await postsAPI.createPost({
        content: newPostContent,
        tags: [],
        media: mediaUrl ? [{ type: mediaType!, url: mediaUrl }] : undefined,
      });

      const normalizedNewPost: Post = {
        id: (newPost.id || Date.now()).toString(),
        content: newPost.content || newPostContent,
        created_at: newPost.created_at || new Date().toISOString(),
        author: {
          id: (newPost.author?.id || user?.id || "").toString(),
          username: newPost.author?.username || user?.username || "You",
          alias: newPost.author?.alias || user?.alias,
          avatar: newPost.author?.avatar || user?.avatar,
        },
        reactions: {
          likes: 0,
          comments: 0,
          shares: 0,
        },
        media: mediaUrl
          ? [{ type: mediaType!, url: mediaUrl }]
          : selectedMedia
            ? [{ type: selectedMedia.type, url: selectedMedia.preview }]
            : undefined,
        tags: newPost.tags || [],
        isLiked: false,
        isBookmarked: false,
      };

      setPosts([normalizedNewPost, ...posts]);
      setNewPostContent("");
      handleMediaClear();
    } catch (err) {
      console.error("Failed to create post:", err);
      if (!isAuthenticated) {
        toast.warning("Войдите, чтобы создавать посты");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const scrollToTop = () => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filters = [
    { id: "all", label: "Все посты", icon: Hash },
    { id: "my", label: "Мои посты", icon: User },
    { id: "following", label: "Подписки", icon: Heart },
    { id: "trending", label: "Популярное", icon: TrendingUp },
  ] as const;

  const filteredPosts =
    selectedFilter === "my"
      ? posts.filter(
          (p) =>
            p.author.id === user?.id?.toString() ||
            p.author.username === user?.username,
        )
      : posts;

  const handleMediaSelect = (
    file: File,
    preview: string,
    type: "image" | "video",
  ) => {
    setSelectedMedia({ file, preview, type });
  };

  const handleMediaClear = () => {
    if (selectedMedia?.preview) {
      URL.revokeObjectURL(selectedMedia.preview);
    }
    setSelectedMedia(null);
  };

  const handleLike = async (postId: string) => {
    try {
      const updatedPosts = posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              reactions: {
                ...p.reactions,
                likes: p.reactions.likes + (!p.isLiked ? 1 : -1),
              },
            }
          : p,
      );
      setPosts(updatedPosts);

      if (!posts.find((p) => p.id === postId)?.isLiked) {
        await postsAPI.likePost(postId);
      } else {
        await postsAPI.unlikePost(postId);
      }
    } catch (error) {
      console.error("Failed to like post:", error);
      setPosts(posts);
    }
  };

  const handleBookmark = async (postId: string) => {
    try {
      const updatedPosts = posts.map((p) =>
        p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p,
      );
      setPosts(updatedPosts);

      if (!posts.find((p) => p.id === postId)?.isBookmarked) {
        await postsAPI.addBookmark(postId);
      } else {
        await postsAPI.removeBookmark(postId);
      }
    } catch (error) {
      console.error("Failed to bookmark post:", error);
      setPosts(posts);
    }
  };

  const handleRating = async (postId: string, rating: number) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      
      const hadPreviousRating = post.userRating !== undefined && post.userRating !== null && post.userRating > 0;
      const prevRating = post.userRating || 0;
      const prevCount = post.ratingCount || 0;
      const prevAvg = post.averageRating || 0;
      
      let newAvg: number;
      let newCount: number;
      
      if (hadPreviousRating) {
        newCount = prevCount;
        newAvg = prevCount > 0 
          ? (prevAvg * prevCount - prevRating + rating) / prevCount 
          : rating;
      } else {
        newCount = prevCount + 1;
        newAvg = (prevAvg * prevCount + rating) / newCount;
      }
      
      const updatedPosts = posts.map((p) =>
        p.id === postId
          ? { ...p, userRating: rating, averageRating: newAvg, ratingCount: newCount }
          : p
      );
      setPosts(updatedPosts);
      
      await ratingsAPI.ratePost(postId, rating);
    } catch (error) {
      console.error("Failed to rate post:", error);
      loadPosts(selectedFilter);
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-background">
        {/* Mobile Filter Tabs */}
        <div className="lg:hidden flex flex-col gap-2 p-3 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex overflow-x-auto gap-2">
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={cn(
                    "flex items-center gap-2 h-8 px-3 rounded-md whitespace-nowrap transition-all duration-150 ease-standard text-sm",
                    selectedFilter === filter.id
                      ? "bg-card text-foreground font-medium shadow-soft border border-border"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
          {selectedTag && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent border border-emerald-200 text-accent-foreground">
              <Hash className="w-4 h-4" />
              <span className="text-sm font-medium">#{selectedTag}</span>
              <button
                onClick={clearTagFilter}
                className="ml-auto p-1 hover:bg-emerald-100 rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar - Filters (Desktop only) */}
        <aside className="hidden lg:block w-64 border-r border-border bg-card p-4 space-y-1 overflow-y-auto shrink-0">
          <h2 className="text-lg font-display font-bold mb-4 tracking-tight text-graphite-900 px-3">
            Фильтры ленты
          </h2>
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={cn(
                  "relative w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-all duration-150 ease-standard",
                  selectedFilter === filter.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {selectedFilter === filter.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                )}
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                <span>{filter.label}</span>
              </button>
            );
          })}

          <div className="my-4 h-px bg-border" />

          <div className="space-y-2 pt-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2 px-3">
              Популярные теги
            </h3>
            {selectedTag && (
              <div className="mb-3 p-2 rounded-lg bg-accent border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-accent-foreground">Фильтр: #{selectedTag}</span>
                  <button
                    onClick={clearTagFilter}
                    className="p-1 hover:bg-emerald-100 rounded transition-colors text-accent-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {popularTags.length > 0 ? popularTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleTagClick(tag.name)}
                className={cn(
                  "block w-full text-left px-3 py-1.5 rounded-full bg-secondary text-sm border border-transparent transition-all duration-150 flex items-center justify-between hover:bg-graphite-200",
                  selectedTag === tag.name && "bg-accent border-emerald-200 text-accent-foreground"
                )}
              >
                <span>#{tag.name}</span>
                <span className="text-xs text-muted-foreground">{tag.count}</span>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">Пока нет тегов</p>
            )}
          </div>
        </aside>

        {/* Main Feed */}
        <main ref={feedRef} className="flex-1 overflow-y-auto relative">
          <div className="max-w-2xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Stories */}
            <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
              <Stories 
                viewUserId={viewingUserStory} 
                onCloseViewer={() => setViewingUserStory(null)} 
              />
            </div>

            {/* New Posts Banner */}
            {newPostsCount > 0 && (
              <button
                onClick={loadNewPosts}
                className="w-full rounded-xl border border-border bg-card shadow-soft p-3 flex items-center justify-center gap-2 text-primary font-medium hover:bg-accent transition-colors animate-rise-in"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{newPostsCount} {newPostsCount === 1 ? 'новый пост' : newPostsCount < 5 ? 'новых поста' : 'новых постов'}</span>
              </button>
            )}

            {/* Fixed Header - Create Post */}
            <div className="sticky top-0 z-10 mb-6 animate-rise-in">
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex gap-4">
                  <Avatar
                    src={user?.avatar}
                    alt={user?.username || "User"}
                    userId={user?.id?.toString() || "demo"}
                    size="md"
                  />
                  <div className="flex-1 space-y-3">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Что у вас нового?"
                      className="input-field resize-none hover:border-graphite-300"
                      rows={3}
                    />

                    {/* Media Preview */}
                    {selectedMedia && (
                      <div className="relative rounded-lg overflow-hidden border border-border bg-graphite-100">
                        {selectedMedia.type === "image" ? (
                          <img
                            src={selectedMedia.preview}
                            alt="Preview"
                            className="max-h-[200px] w-full object-contain"
                          />
                        ) : (
                          <video
                            src={selectedMedia.preview}
                            className="max-h-[200px] w-full object-contain"
                            controls
                          />
                        )}
                        <button
                          type="button"
                          onClick={handleMediaClear}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-graphite-950/70 hover:bg-graphite-950/90 text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-graphite-950/70 text-[11px] text-white">
                          {selectedMedia.type === "image" ? (
                            <ImageIcon className="w-3 h-3" />
                          ) : (
                            <Video className="w-3 h-3" />
                          )}
                          <span>
                            {selectedMedia.type === "image" ? "Фото" : "Видео"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <MediaUpload
                          onMediaSelect={handleMediaSelect}
                          onClear={handleMediaClear}
                          selectedMedia={selectedMedia}
                          maxSizeMB={50}
                        />
                      </div>
                      <button
                        onClick={handleCreatePost}
                        disabled={
                          (!newPostContent.trim() && !selectedMedia) ||
                          isUploading
                        }
                        className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft transition-all duration-150 ease-standard hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Загрузка...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Опубликовать
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card shadow-soft p-5 animate-rise-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex gap-4 mb-4">
                      <div className="skeleton w-12 h-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-32" />
                        <div className="skeleton h-3 w-24" />
                      </div>
                    </div>
                    <div className="skeleton h-20 w-full mb-4" />
                    <div className="skeleton h-8 w-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredPosts.length === 0 && (
              <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                  <User className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mt-4">
                  {selectedFilter === "my"
                    ? "У вас пока нет постов"
                    : selectedFilter === "following"
                    ? "Нет постов от подписок"
                    : "Лента пуста"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto mt-1">
                  {selectedFilter === "my"
                    ? "Создайте свой первый пост выше!"
                    : "Будьте первым, кто создаст пост!"}
                </p>
              </div>
            )}

            {!loading &&
              filteredPosts.map((post, index) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-border bg-card text-card-foreground shadow-soft p-5 mb-4 animate-rise-in"
                  style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
                >
                  {/* Post Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => handleViewUserStory(post.author.id)}
                      className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Avatar
                        src={post.author.avatar}
                        alt={post.author.username}
                        userId={post.author.id}
                        size="md"
                      />
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={`/profile/${post.author.id}`}
                          className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer"
                        >
                          {post.author.alias || post.author.username}
                        </a>
                        {isAuthenticated && post.author.id !== user?.id?.toString() && (
                          <button
                            type="button"
                            onClick={() => handleSubscribe(post.author.id)}
                            className={cn(
                              "px-3 py-1 text-xs font-medium rounded-full transition-all duration-150",
                              subscriptions.has(post.author.id)
                                ? "bg-secondary text-secondary-foreground hover:bg-danger-soft hover:text-destructive"
                                : "bg-primary text-primary-foreground hover:bg-emerald-800"
                            )}
                          >
                            {subscriptions.has(post.author.id) ? (
                              <span className="flex items-center gap-1">
                                <UserMinus className="w-3 h-3" />
                                Отписаться
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <UserPlus className="w-3 h-3" />
                                Подписаться
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(post.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(post.author.id === user?.id?.toString() ||
                        post.author.username === user?.username) && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(post)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Редактировать пост"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 rounded-lg hover:bg-danger-soft transition-colors"
                            title="Удалить пост"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleShare(post.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Поделиться"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="mb-4">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  </div>

                  {/* Post Media */}
                  {post.media && post.media.length > 0 && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-border">
                      {post.media.map((m, idx) => (
                        <div key={idx}>
                          {m.type === "image" ? (
                            <img
                              src={m.url}
                              alt="Post media"
                              className="w-full max-h-[520px] object-cover bg-graphite-100"
                            />
                          ) : (
                            <video
                              src={m.url}
                              controls
                              className="w-full max-h-[520px] object-contain bg-graphite-950"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className={cn(
                            "px-3 py-1 rounded-full bg-secondary text-sm border border-transparent cursor-pointer hover:bg-accent hover:border-emerald-200 hover:text-accent-foreground transition-all duration-150",
                            selectedTag === tag && "bg-accent border-emerald-200 text-accent-foreground"
                          )}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Rating */}
                  <div className="flex items-center gap-3 mb-4">
                    <StarRating
                      rating={post.userRating || 0}
                      interactive={isAuthenticated}
                      size="md"
                      onRate={(rating) => handleRating(post.id, rating)}
                    />
                    {(post.ratingCount || 0) > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {(post.averageRating || 0).toFixed(1)} ({post.ratingCount})
                      </span>
                    )}
                  </div>

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t border-border">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={cn(
                        "flex items-center gap-2 transition-colors duration-150 ease-standard",
                        post.isLiked
                          ? "text-emerald-600"
                          : "text-muted-foreground hover:text-emerald-600",
                      )}
                    >
                      <Heart
                        key={String(post.isLiked)}
                        className={cn(
                          "w-5 h-5",
                          post.isLiked && "fill-current animate-scale-in",
                        )}
                      />
                      <span className="text-sm font-medium">
                        {post.reactions?.likes ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleOpenComments(post.id)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 transition-colors duration-150 ease-standard"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {post.reactions?.comments ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleShare(post.id)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 transition-colors duration-150 ease-standard"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {post.reactions?.shares ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBookmark(post.id)}
                      className={cn(
                        "ml-auto transition-colors duration-150 ease-standard",
                        post.isBookmarked
                          ? "text-emerald-600"
                          : "text-muted-foreground hover:text-emerald-600",
                      )}
                    >
                      <Bookmark
                        key={String(post.isBookmarked)}
                        className={cn(
                          "w-5 h-5",
                          post.isBookmarked && "fill-current animate-scale-in",
                        )}
                      />
                    </button>
                  </div>
                </article>
              ))}

            {/* Loading More Indicator */}
            <div ref={loadMoreRef} className="py-4">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-muted-foreground text-sm">Загрузка...</span>
                </div>
              )}
            </div>

            {/* End of Feed */}
            {!loading && !hasMore && filteredPosts.length > 0 && (
              <div className="text-center py-8">
                <div className="my-4 h-px bg-border" />
                <p className="text-muted-foreground text-sm mt-6">
                  Вы достигли конца ленты
                </p>
              </div>
            )}
          </div>

          {/* Scroll to Top Button */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-8 right-8 p-3 rounded-full bg-primary
                         text-primary-foreground shadow-pop hover:bg-emerald-800 hover:shadow-lg-brand transition-all
                         duration-150 ease-standard active:scale-[0.97] animate-rise-in"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          )}
        </main>
      </div>

      {/* Comment Modal */}
      {commentModal.open && (
        <div
          className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-[100] animate-fade-in-soft"
          onClick={handleCloseComments}
        >
          <div
            className="rounded-2xl border border-border bg-card shadow-pop w-full max-w-lg mx-4 max-h-[80vh] flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Комментарии</h3>
              <button
                type="button"
                onClick={handleCloseComments}
                className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
              {loadingComments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Пока нет комментариев. Будьте первым!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar
                      src={comment.avatar}
                      alt={comment.username}
                      userId={String(comment.user_id)}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{comment.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Напишите комментарий..."
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary text-primary-foreground shadow-soft transition-all duration-150 hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && (
        <div
          className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-[100] animate-fade-in-soft"
          onClick={handleCloseEdit}
        >
          <div
            className="rounded-2xl border border-border bg-card shadow-pop w-full max-w-lg mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Редактировать пост</h3>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="input-field resize-none min-h-[120px]"
                placeholder="Текст поста..."
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 h-10 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Notification */}
      {shareNotification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-card border border-border text-foreground px-5 py-3 rounded-full shadow-pop flex items-center gap-2 z-[100] animate-toast-in">
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium">Ссылка скопирована!</span>
        </div>
      )}

      <ConfirmDialog
        isOpen={deletePostId !== null}
        onClose={() => setDeletePostId(null)}
        onConfirm={() => { void confirmDeletePost(); }}
        title="Удалить пост?"
        message="Пост будет удалён без возможности восстановления."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        loading={isDeletingPost}
      />
    </Layout>
  );
}
