import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { Stories } from "@/components/Stories";
import { MediaUpload } from "@/components/MediaUpload";
import { useStore } from "@/lib/store";
import { postsAPI, uploadAPI } from "@/lib/api";
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
}


interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

export default function FeedPage() {
  const { user, isAuthenticated } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "following" | "trending" | "my"
  >("all");
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
  const feedRef = useRef<HTMLDivElement>(null);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await postsAPI.getPosts();
      const normalizedData = (data || []).map((p: any) => ({
        id: (p.id || "").toString(),
        content: p.content || "",
        created_at: p.created_at || new Date().toISOString(),
        author: {
          id: (p.author?.id || p.user_id || "").toString(),
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
        isLiked: p.isLiked || false,
        isBookmarked: p.isBookmarked || false,
      }));

      setPosts(normalizedData);
    } catch (err) {
      console.error("Failed to load posts:", err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (feedRef.current) {
        setShowScrollTop(feedRef.current.scrollTop > 500);
      }
    };

    feedRef.current?.addEventListener("scroll", handleScroll);
    return () => feedRef.current?.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Удалить этот пост?")) return;

    try {
      await postsAPI.deletePost(postId);
      setPosts(posts.filter((p) => p.id !== postId));
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Не удалось удалить пост. Попробуйте ещё раз.");
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
      alert("Не удалось добавить комментарий");
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
      alert("Войдите, чтобы подписаться");
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
          alert("Не удалось загрузить медиа файл. Попробуйте ещё раз.");
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
        alert("Войдите чтобы создавать посты");
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

  return (
    <Layout>
      <div className="h-full lg:h-screen flex flex-col lg:flex-row overflow-hidden bg-nebula">
        {/* Mobile Filter Tabs */}
        <div className="lg:hidden flex overflow-x-auto gap-2 p-3 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-300 text-sm",
                  selectedFilter === filter.id
                    ? "bg-primary/20 border border-primary/50"
                    : "bg-accent/10 border border-transparent",
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar - Filters (Desktop only) */}
        <aside className="hidden lg:block w-64 border-r border-border/50 p-4 space-y-2 overflow-y-auto shrink-0">
          <h2 className="text-lg font-bold mb-4 gradient-text">
            Фильтры ленты
          </h2>
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                  selectedFilter === filter.id
                    ? "bg-primary/20 border border-primary/50 glow-cosmic"
                    : "hover:bg-accent/10 border border-transparent",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{filter.label}</span>
              </button>
            );
          })}

          <div className="divider-cosmic" />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Популярные теги
            </h3>
            {["react", "webdev", "design", "typescript", "ai"].map((tag) => (
              <button key={tag} className="badge-cosmic block w-full text-left">
                #{tag}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Feed */}
        <main ref={feedRef} className="flex-1 overflow-y-auto relative">
          <div className="max-w-2xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Stories */}
            <div className="glass-cosmic rounded-2xl overflow-hidden">
              <Stories 
                viewUserId={viewingUserStory} 
                onCloseViewer={() => setViewingUserStory(null)} 
              />
            </div>

            {/* Fixed Header - Create Post */}
            <div className="sticky top-0 z-10 mb-6 animate-fade-in">
              <div className="glass-cosmic rounded-2xl p-6 glow-cosmic">
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
                      className="w-full px-4 py-3 bg-background/50 border border-border/50 rounded-lg
                                text-foreground placeholder:text-muted-foreground resize-none
                                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                transition-all duration-300 hover:border-primary/50"
                      rows={3}
                    />

                    {/* Media Preview */}
                    {selectedMedia && (
                      <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black/20">
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
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-xs text-white">
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
                        className="btn-cosmic px-6 flex items-center gap-2"
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
                    className="glass-cosmic rounded-2xl p-6 animate-slide-in"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex gap-4 mb-4">
                      <div className="skeleton-cosmic w-12 h-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton-cosmic h-4 w-32" />
                        <div className="skeleton-cosmic h-3 w-24" />
                      </div>
                    </div>
                    <div className="skeleton-cosmic h-20 w-full mb-4" />
                    <div className="skeleton-cosmic h-8 w-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredPosts.length === 0 && (
              <div className="glass-cosmic rounded-2xl p-8 text-center">
                <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {selectedFilter === "my" 
                    ? "У вас пока нет постов" 
                    : selectedFilter === "following"
                    ? "Нет постов от подписок"
                    : "Пока нет постов"}
                </h3>
                <p className="text-muted-foreground">
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
                  className="glass-cosmic card-cosmic rounded-2xl p-6 animate-slide-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Post Header */}
                  <div className="flex items-start gap-4 mb-4">
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
                          className="font-semibold hover:text-primary transition-colors cursor-pointer"
                        >
                          {post.author.alias || post.author.username}
                        </a>
                        {isAuthenticated && post.author.id !== user?.id?.toString() && (
                          <button
                            type="button"
                            onClick={() => handleSubscribe(post.author.id)}
                            className={cn(
                              "px-3 py-1 text-xs font-medium rounded-full transition-all",
                              subscriptions.has(post.author.id)
                                ? "bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
                                : "bg-primary text-primary-foreground hover:bg-primary/80"
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
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                          title="Удалить пост"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleShare(post.id)}
                        className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
                        title="Поделиться"
                      >
                        <Share2 className="w-4 h-4 text-muted-foreground" />
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
                    <div className="mb-4 rounded-lg overflow-hidden">
                      {post.media.map((m, idx) => (
                        <div key={idx}>
                          {m.type === "image" ? (
                            <img
                              src={m.url}
                              alt="Post media"
                              className="w-full max-h-[400px] object-contain bg-black/20 rounded-lg"
                            />
                          ) : (
                            <video
                              src={m.url}
                              controls
                              className="w-full max-h-[400px] object-contain bg-black/20 rounded-lg"
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
                        <span key={tag} className="badge-cosmic">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t border-border/30">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={cn(
                        "flex items-center gap-2 transition-all duration-300 hover:scale-110",
                        post.isLiked
                          ? "text-red-500"
                          : "text-muted-foreground hover:text-red-500",
                      )}
                    >
                      <Heart
                        className={cn(
                          "w-5 h-5",
                          post.isLiked && "fill-current",
                        )}
                      />
                      <span className="text-sm font-medium">
                        {post.reactions?.likes ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleOpenComments(post.id)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {post.reactions?.comments ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleShare(post.id)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-all duration-300 hover:scale-110"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {post.reactions?.shares ?? 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBookmark(post.id)}
                      className={cn(
                        "ml-auto transition-all duration-300 hover:scale-110",
                        post.isBookmarked
                          ? "text-accent"
                          : "text-muted-foreground hover:text-accent",
                      )}
                    >
                      <Bookmark
                        className={cn(
                          "w-5 h-5",
                          post.isBookmarked && "fill-current",
                        )}
                      />
                    </button>
                  </div>
                </article>
              ))}

            {/* End of Feed */}
            {!loading && filteredPosts.length > 0 && (
              <div className="text-center py-8">
                <div className="divider-cosmic" />
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
              className="fixed bottom-8 right-8 p-4 rounded-full bg-gradient-to-br from-primary to-accent
                         text-primary-foreground shadow-lg glow-cosmic hover:scale-110 transition-all
                         duration-300 animate-fade-in"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          )}
        </main>
      </div>

      {/* Comment Modal */}
      {commentModal.open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={handleCloseComments}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Комментарии</h3>
              <button
                type="button"
                onClick={handleCloseComments}
                className="p-2 hover:bg-accent/20 rounded-lg transition-colors"
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
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Notification */}
      {shareNotification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-[100] animate-fade-in">
          <Check className="w-5 h-5" />
          <span>Ссылка скопирована!</span>
        </div>
      )}
    </Layout>
  );
}
