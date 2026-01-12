// API Client for Rust backend communication

const API_BASE_URL = "/api";

interface FetchOptions extends RequestInit {
  data?: any;
}

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Ensure that any dynamic path segment is safely encoded so it cannot alter the URL structure
function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

async function request<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { data, headers, ...restOptions } = options;

  const config: RequestInit = {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  // Get token from localStorage
  const token = localStorage.getItem("token");
  if (token) {
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    let responseData: any;

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      throw new APIError(
        responseData?.message ||
          responseData?.error ||
          responseData ||
          "Request failed",
        response.status,
        responseData,
      );
    }

    return responseData as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      error instanceof Error ? error.message : "Network error",
      0,
    );
  }
}

// Authentication API
export const authAPI = {
  login: (username: string, password: string) =>
    request<{ user: User; token: string; message: string }>("/auth/login", {
      method: "POST",
      data: { username, password },
    }).then((res) => {
      if (res.token) {
        localStorage.setItem("token", res.token);
      }
      return res;
    }),

  register: (username: string, email: string, password: string) =>
    request<{ user: User; token: string; message: string }>("/auth/register", {
      method: "POST",
      data: { username, email, password },
    }).then((res) => {
      if (res.token) {
        localStorage.setItem("token", res.token);
      }
      return res;
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
    }),

  getMe: () => request<User>("/auth/me"),

  generateQRLogin: () =>
    request<{ token: string; expires_at: string }>("/auth/qr/generate", {
      method: "POST",
    }),

  checkQRLoginStatus: (token: string) =>
    request<{
      status: string;
      jwt_token?: string;
      user?: User;
      expires_at: string;
    }>(`/auth/qr/status/${token}`),

  confirmQRLogin: (token: string) =>
    request<{ message: string; username: string }>(
      `/auth/qr/confirm/${token}`,
      {
        method: "POST",
      },
    ),
};

// User Profile Response Type
export interface UserProfile {
  id: number;
  username: string;
  avatar: string;
  bio: string;
  role: string;
  created_at: string;
  followers_count: number;
  following_count: number;
  is_subscribed: boolean;
}

export interface UserStats {
  followers_count: number;
  following_count: number;
  posts_count: number;
  friends_count: number;
}

// User API
export const userAPI = {
  search: (query: string) =>
    request<User[]>(`/users/search?q=${encodeURIComponent(query)}`),

  getUser: (id: string) => request<User>(`/users/${id}`),
  
  getProfile: (id: string) => request<UserProfile>(`/users/${id}/profile`),
  
  getStats: (id: string) => request<UserStats>(`/users/${id}/stats`),

  updateProfile: (data: Partial<User>) =>
    request<User>("/users/me", {
      method: "PUT",
      data,
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const token = localStorage.getItem("token");
    const headers: any = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: "POST",
      body: formData,
      headers,
    }).then((res) => res.json());
  },
  
  subscribe: (id: string) =>
    request<{ status: string; id: number }>(`/users/${id}/subscribe`, {
      method: "POST",
    }),
    
  unsubscribe: (id: string) =>
    request<{ status: string }>(`/users/${id}/subscribe`, {
      method: "DELETE",
    }),
    
  getPremium: (id: string) => 
    request<{
      has_premium: boolean;
      plan_name?: string;
      plan_slug?: string;
      current_period_end?: string;
      auto_renew?: boolean;
    }>(`/users/${id}/premium`),
    
  getDonations: (id: string) =>
    request<{
      donations: Array<{
        id: number;
        amount_rub: number;
        message: string;
        created_at: string;
      }>;
      total: number;
    }>(`/users/${id}/donations`),
    
  createDonation: (id: string, data: { amount: number; message?: string }) =>
    request<{ id: number; status: string; message: string }>(`/users/${id}/donate`, {
      method: "POST",
      data,
    }),
};

// Premium API
export const premiumAPI = {
  getPlans: () =>
    request<Array<{
      id: number;
      slug: string;
      name: string;
      description: string;
      price_rub: number;
      billing_cycle: string;
      features: string;
      is_active: boolean;
    }>>('/premium/plans'),
  
  getUserPremium: (userId: string) =>
    request<{
      has_premium: boolean;
      plan_name?: string;
      expires_at?: string;
    }>(`/users/${userId}/premium`),
    
  getSubscription: () =>
    request<{
      id?: number;
      plan_id?: number;
      plan_name?: string;
      status?: string;
      current_period_start?: string;
      current_period_end?: string;
      auto_renew?: boolean;
      cancel_at_period_end?: boolean;
    }>('/premium/subscription'),
    
  checkout: (planId: number) =>
    request<{
      payment_id: string;
      confirmation_url: string;
    }>('/premium/checkout', {
      method: 'POST',
      data: { plan_id: planId },
    }),
    
  cancelSubscription: () =>
    request<{ status: string }>('/premium/cancel', {
      method: 'POST',
    }),
    
  getTransactions: () =>
    request<Array<{
      id: number;
      plan_id: number;
      amount_rub: number;
      status: string;
      payment_provider: string;
      created_at: string;
      completed_at?: string;
    }>>('/premium/transactions'),
};

// User Requests API
export const requestsAPI = {
  create: (data: { category: string; subject: string; description: string; priority?: string }) =>
    request<{ status: string; id: number }>('/requests', {
      method: 'POST',
      data,
    }),
    
  getMyRequests: () =>
    request<Array<{
      id: number;
      category: string;
      subject: string;
      description: string;
      priority: string;
      status: string;
      admin_notes?: string;
      created_at: string;
      updated_at: string;
    }>>('/requests/my'),
    
  cancel: (id: number) =>
    request<{ status: string }>(`/requests/${id}`, {
      method: 'DELETE',
    }),
};

// Messages API (Consolidated)
export const messagesAPI = {
  getConversations: () => request<Conversation[]>("/messages/conversations"),

  getMessages: (userId: string, limit: number = 50, offset: number = 0) =>
    request<Message[]>(
      `/messages/with/${userId}?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
      },
    ),

  sendMessage: (toUserId: string, content: string, options?: {
    replyToId?: number;
    voiceUrl?: string;
    voiceDuration?: number;
    forwardedFromId?: number;
  }) =>
    request<Message>("/messages", {
      method: "POST",
      data: { 
        to_user_id: toUserId, 
        content, 
        reply_to_id: options?.replyToId,
        voice_url: options?.voiceUrl,
        voice_duration: options?.voiceDuration,
        forwarded_from_id: options?.forwardedFromId,
      },
    }),

  deleteMessage: (id: string) =>
    request<{ success: boolean }>(
      `/messages/delete/${encodePathSegment(id)}`,
      {
        method: "DELETE",
      },
    ),

  markAsRead: (messageId: string) =>
    request<{ success: boolean }>(
      `/messages/${encodePathSegment(messageId)}/read`,
      {
        method: "POST",
      },
    ),

  updateMessage: (messageId: string, content: string) =>
    request<Message>(`/messages/update/${encodePathSegment(messageId)}`, {
      method: "PUT",
      data: { content },
    }),

  addReaction: (messageId: string, emoji: string) =>
    request<{ status: string }>(
      `/messages/${encodePathSegment(messageId)}/reactions`,
      {
        method: "POST",
        data: { emoji },
      },
    ),

  removeReaction: (messageId: string, emoji: string) =>
    request<{ status: string }>(
      `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      {
        method: "DELETE",
      },
    ),

  searchMessages: (query: string, userId?: string) =>
    request<Message[]>(`/messages/search?q=${encodeURIComponent(query)}${userId ? `&user_id=${userId}` : ''}`),

  forwardMessage: (messageId: number, toUserId: string) =>
    request<Message>("/messages/forward", {
      method: "POST",
      data: { message_id: messageId, to_user_id: toUserId },
    }),

  pinMessage: (messageId: string) =>
    request<Message>(`/messages/pin/${messageId}`, {
      method: "POST",
    }),

  getPinnedMessages: (userId: string) =>
    request<Message[]>(`/messages/pinned/${userId}`),
};

// Stories API
export const storiesAPI = {
  getStories: () => request<Story[]>("/stories"),

  createStory: (content: string, mediaUrl?: string, mediaType?: string) =>
    request<Story>("/stories", {
      method: "POST",
      data: { content, media_url: mediaUrl, media_type: mediaType },
    }),

  viewStory: (storyId: string) =>
    request<{ status: string }>(`/stories/${storyId}/view`, {
      method: "POST",
    }),

  deleteStory: (storyId: string) =>
    request<{ status: string }>(`/stories/${storyId}`, {
      method: "DELETE",
    }),
};

// Post Ratings API
export const ratingsAPI = {
  ratePost: (postId: string, rating: number) =>
    request<{ status: string }>(`/posts/${postId}/rate`, {
      method: "POST",
      data: { rating },
    }),

  getPostRating: (postId: string) =>
    request<{ average: number; count: number }>(`/posts/${postId}/rating`),

  getComments: (postId: string) =>
    request<Comment[]>(`/posts/${postId}/comments`),

  addComment: (postId: string, content: string, parentId?: string) =>
    request<Comment>(`/posts/${postId}/comments`, {
      method: "POST",
      data: { content, parent_id: parentId },
    }),

  deleteComment: (commentId: string) =>
    request<{ status: string }>(`/comments/${commentId}`, {
      method: "DELETE",
    }),
};

// Presence API
export const presenceAPI = {
  getUserPresence: (userId: string) =>
    request<{ status: string; last_seen_at?: string }>(
      `/users/${userId}/presence`,
    ),

  updatePresence: (status: string, customStatus?: string) =>
    request<{ status: string }>("/presence", {
      method: "PUT",
      data: { status, custom_status: customStatus },
    }),

  sendTyping: (channelId?: string, chatUserId?: string) =>
    request<{ status: string }>("/typing", {
      method: "POST",
      data: { channel_id: channelId, chat_user_id: chatUserId },
    }),
};

// Invites API
export const invitesAPI = {
  createInvite: (guildId?: string, maxUses?: number) =>
    request<InviteLink>("/invites", {
      method: "POST",
      data: { guild_id: guildId, max_uses: maxUses },
    }),

  getInvite: (code: string) => request<InviteLink>(`/invites/${code}`),

  useInvite: (code: string) =>
    request<{ status: string }>(`/invites/${code}/use`, {
      method: "POST",
    }),
};

// Referral API
export const referralAPI = {
  getMyReferral: () =>
    request<{ code: string; invite_count: number; username: string }>(
      "/referral/my",
    ),

  getReferralInfo: (code: string) =>
    request<{
      code: string;
      inviter: string;
      inviter_id: number;
      avatar?: string;
    }>(`/referral/info/${code}`),

  useReferral: (code: string) =>
    request<{ status: string; inviter: string }>(`/referral/use/${code}`, {
      method: "POST",
    }),

  getInvitedUsers: () =>
    request<{
      invited_users: Array<{
        id: number;
        username: string;
        avatar?: string;
        invited_at: string;
      }>;
      count: number;
    }>("/referral/invited"),
};

// Admin API
export const adminAPI = {
  getStats: () => request<AdminStats>("/admin/stats"),

  getUsers: (page: number = 1, limit: number = 50) =>
    request<{ users: User[]; total: number }>(
      `/admin/users?page=${page}&limit=${limit}`,
    ),

  banUser: (userId: string, reason?: string) =>
    request<{ status: string }>(`/admin/users/${userId}/ban`, {
      method: "POST",
      data: { reason },
    }),

  unbanUser: (userId: string) =>
    request<{ status: string }>(`/admin/users/${userId}/ban`, {
      method: "DELETE",
    }),

  getIPBans: () => request<IPBan[]>("/admin/ip-bans"),

  createIPBan: (ipAddress: string, reason?: string) =>
    request<IPBan>("/admin/ip-bans", {
      method: "POST",
      data: { ip_address: ipAddress, reason },
    }),

  deleteIPBan: (banId: string) =>
    request<{ status: string }>(`/admin/ip-bans/${banId}`, {
      method: "DELETE",
    }),

  getReports: (status: string = "pending") =>
    request<AbuseReport[]>(`/admin/reports?status=${status}`),

  updateReport: (reportId: string, status: string) =>
    request<{ status: string }>(`/admin/reports/${reportId}`, {
      method: "PUT",
      data: { status },
    }),

  getAuditLogs: (page: number = 1, limit: number = 50) =>
    request<{ logs: AuditLog[]; total: number }>(
      `/admin/audit-logs?page=${page}&limit=${limit}`,
    ),

  getForbiddenWords: () => request<ForbiddenWord[]>("/admin/forbidden-words"),

  addForbiddenWord: (word: string, category?: string, isRegex?: boolean) =>
    request<ForbiddenWord>("/admin/forbidden-words", {
      method: "POST",
      data: { word, category, is_regex: isRegex },
    }),

  updateForbiddenWord: (
    wordId: string,
    word: string,
    category?: string,
    isRegex?: boolean,
  ) =>
    request<ForbiddenWord>(`/admin/forbidden-words/${wordId}`, {
      method: "PUT",
      data: { word, category, is_regex: isRegex },
    }),

  deleteForbiddenWord: (wordId: string) =>
    request<{ status: string }>(`/admin/forbidden-words/${wordId}`, {
      method: "DELETE",
    }),

  getForbiddenAttempts: (page: number = 1, limit: number = 50) =>
    request<{ attempts: ForbiddenAttempt[]; total: number }>(
      `/admin/forbidden-attempts?page=${page}&limit=${limit}`,
    ),

  getBillingStats: () => request<BillingStats>("/admin/billing/stats"),

  refundTransaction: (transactionId: string, reason: string) =>
    request<{ status: string }>("/admin/billing/refund", {
      method: "POST",
      data: { transaction_id: parseInt(transactionId), reason },
    }),
};

export interface BillingStats {
  active_subscriptions: number;
  monthly_revenue: number;
  total_revenue: number;
  new_subscriptions: number;
  cancelled_subscriptions: number;
  churn_rate: number;
  recent_transactions: BillingTransaction[];
}

export interface BillingTransaction {
  id: number;
  user_id: number;
  username: string;
  amount_rub: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ForbiddenWord {
  id: string;
  word: string;
  category: string;
  is_regex: boolean;
  added_by: string;
  created_at: string;
}

export interface ForbiddenAttempt {
  id: string;
  user_id: string;
  attempted_content: string;
  matched_words: string;
  context: string;
  created_at: string;
}

export const contentAPI = {
  validateContent: (content: string, context?: string) =>
    request<{ is_forbidden: boolean; matched_words: string[] }>(
      "/content/validate",
      {
        method: "POST",
        data: { content, context },
      },
    ),
};

export const telegramAPI = {
  getLink: () =>
    request<{
      linked: boolean;
      telegram_username?: string;
      telegram_id?: number;
      verified_at?: string;
    }>("/telegram/link"),

  createLink: () =>
    request<{ code: string; bot_username: string; expires_in: number }>(
      "/telegram/link",
      {
        method: "POST",
      },
    ),

  unlinkTelegram: () =>
    request<{ status: string }>("/telegram/link", {
      method: "DELETE",
    }),

  updateSettings: (telegramNotifications: boolean) =>
    request<{ status: string }>("/telegram/settings", {
      method: "PUT",
      data: { telegram_notifications: telegramNotifications },
    }),
};

export const notificationsAPI = {
  getNotifications: (page: number = 1, limit: number = 50) =>
    request<{ notifications: TelegramNotification[]; total: number }>(
      `/notifications?page=${page}&limit=${limit}`,
    ),
};

export interface TelegramNotification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  sent_to_telegram: boolean;
  sent_to_site: boolean;
  created_at: string;
}

// Guilds API
export const guildsAPI = {
  getGuilds: () => request<any[]>("/guilds"),

  createGuild: (name: string, description?: string) =>
    request<any>("/guilds", {
      method: "POST",
      data: { name, description },
    }),

  getGuild: (id: string) => request<any>(`/guilds/view/${id}`),

  getMembers: () => request<any[]>("/users/all"),
};

// Channels API
export const channelsAPI = {
  getChannels: (guildId: string) =>
    request<Channel[]>(`/guilds/channels/${guildId}`),

  getChannel: (id: string) => request<Channel>(`/channels/${id}`),

  createChannel: (
    guildId: string,
    name: string,
    channelType: "text" | "voice",
    description?: string,
  ) =>
    request<Channel>(`/guilds/channels/${guildId}`, {
      method: "POST",
      data: { name, type: channelType, description },
    }),

  getMessages: (channelId: string, limit = 50) =>
    request<ChannelMessage[]>(`/channels/${channelId}/messages?limit=${limit}`),

  sendMessage: (channelId: string, content: string) =>
    request<ChannelMessage>(`/channels/${channelId}/messages`, {
      method: "POST",
      data: { content },
    }),

  updateChannel: (
    channelId: string,
    data: { name?: string; description?: string },
  ) =>
    request<Channel>(`/channels/${channelId}`, {
      method: "PUT",
      data,
    }),

  deleteChannel: (channelId: string) =>
    request<{ success: boolean }>(`/channels/${channelId}`, {
      method: "DELETE",
    }),
};

// Settings API
export const settingsAPI = {
  getSettings: () => request<Settings>("/settings"),

  updateSettings: (data: Partial<Settings>) =>
    request<Settings>("/settings", {
      method: "PUT",
      data,
    }),
};

// Friends API
export interface BlockedUser {
  id: number;
  user_id: number;
  username: string;
  avatar?: string;
  created_at: string;
}

export const friendsAPI = {
  getFriends: () =>
    request<Friend[]>("/friends", {
      method: "GET",
    }),

  sendFriendRequest: (username: string) =>
    request<FriendRequest>("/friends/request", {
      method: "POST",
      data: { username },
    }),

  respondToFriendRequest: (
    requestId: string,
    action: "accept" | "decline",
  ) =>
    request<{ success: boolean }>("/friends/request/" + requestId, {
      method: "PUT",
      data: { action },
    }),

  cancelFriendRequest: (requestId: string) =>
    request<{ success: boolean }>("/friends/request/" + requestId, {
      method: "DELETE",
    }),

  removeFriend: (friendId: string) =>
    request<{ success: boolean }>("/friends/" + friendId, {
      method: "DELETE",
    }),

  getBlockedUsers: () =>
    request<BlockedUser[]>("/friends/blocked", {
      method: "GET",
    }),

  blockUser: (userId: number) =>
    request<{ success: boolean; id: number }>("/friends/block", {
      method: "POST",
      data: { user_id: userId },
    }),

  unblockUser: (userId: number) =>
    request<{ success: boolean }>("/friends/block/" + userId, {
      method: "DELETE",
    }),

  searchUsers: (query: string) =>
    request<{ id: number; username: string; avatar?: string; bio?: string }[]>(
      `/users/search?q=${encodeURIComponent(query)}`
    ),
};

// Posts API
export const postsAPI = {
  getPosts: async (options?: { filter?: string; tag?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.tag) params.set('tag', options.tag);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const queryString = params.toString();
    const response = await request<{ posts: Post[]; has_more: boolean } | Post[]>(
      `/posts${queryString ? `?${queryString}` : ''}`
    );
    if (Array.isArray(response)) {
      return { posts: response, has_more: false };
    }
    return response;
  },

  createPost: (data: {
    content: string;
    tags: string[];
    media?: { type: "image" | "video"; url: string }[];
  }) =>
    request<Post>("/posts", {
      method: "POST",
      data,
    }),

  deletePost: (postId: string) =>
    request<{ success: boolean }>(`/posts/${postId}`, {
      method: "DELETE",
    }),

  likePost: (postId: string) =>
    request<{ message: string; likes: number }>(`/posts/${postId}/like`, {
      method: "POST",
    }),

  unlikePost: (postId: string) =>
    request<{ message: string; likes: number }>(`/posts/${postId}/like`, {
      method: "DELETE",
    }),

  subscribe: (userId: string) =>
    request<{ message: string; id: number }>(`/users/${userId}/subscribe`, {
      method: "POST",
    }),

  unsubscribe: (userId: string) =>
    request<{ message: string }>(`/users/${userId}/subscribe`, {
      method: "DELETE",
    }),

  getSubscriptions: () =>
    request<{ id: number; user_id: number; username: string; avatar?: string }[]>("/subscriptions"),

  addBookmark: (postId: string) =>
    request<{ success: boolean }>(`/posts/${postId}/bookmark`, {
      method: "POST",
    }),

  removeBookmark: (postId: string) =>
    request<{ success: boolean }>(`/posts/${postId}/bookmark`, {
      method: "DELETE",
    }),

  getComments: (postId: string) =>
    request<{ id: number; user_id: number; username: string; avatar?: string; content: string; created_at: string }[]>(`/posts/${postId}/comments`),

  addComment: (postId: string, content: string) =>
    request<{ id: number; message: string }>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};

export interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    alias?: string;
    avatar?: string;
  };
  content: string;
  tags?: string[];
  media?: {
    type: "image" | "video";
    url: string;
  }[];
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  isLiked?: boolean;
  isBookmarked?: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  from_user_id?: string;
  to_user_id?: string;
  content: string;
  is_read?: boolean;
  read?: boolean;
  edited?: boolean;
  is_pinned?: boolean;
  created_at: string;
  updated_at?: string;
  from_user?: User;
  to_user?: User;
  message_type?: "text" | "voice" | "image" | "file";
  voice_url?: string;
  voice_duration?: number;
  forwarded_from_id?: number;
  reply_to_id?: number;
  reply_to?: Message;
}

export interface Conversation {
  user: User;
  last_message: Message;
  unread_count: number;
}

export interface Channel {
  id: string;
  name: string;
  type: "text" | "voice";
  category_id?: string;
  created_at: string;
  guild_id?: number;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Settings {
  theme: string;
  language: string;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  voice_enabled: boolean;
  openai_key?: string;
  deepseek_key?: string;
  huggingface_key?: string;
  [key: string]: any;
}

export interface Friend {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  bio?: string;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  role?: string;
  alias?: string;
  created_at: string;
  last_seen?: string;
  is_online?: boolean;
  is_premium?: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  view_count: number;
  expires_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  created_at: string;
}

export interface InviteLink {
  id: string;
  code: string;
  guild_id?: string;
  channel_id?: string;
  creator_id: string;
  max_uses?: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export interface AdminStats {
  users: number;
  posts: number;
  messages: number;
  guilds: number;
  online_users: number;
  active_bans: number;
  pending_reports: number;
}

export interface IPBan {
  id: string;
  ip_address: string;
  reason?: string;
  banned_by: string;
  expires_at?: string;
  created_at: string;
}

export interface AbuseReport {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export const uploadAPI = {
  uploadFile: async (
    file: File,
    type: "image" | "video" | "audio",
  ): Promise<{ url: string; type: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Upload failed";
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new APIError(errorMessage, response.status);
    }

    return response.json();
  },
};

// Video Types
export interface Video {
  id: number;
  author_id: number;
  title: string;
  description: string;
  video_url: string;
  thumbnail: string;
  duration: number;
  views: number;
  likes: number;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoWithAuthor extends Video {
  author: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface VideoChapter {
  id: number;
  video_id: number;
  title: string;
  timestamp: number;
  duration: number;
  summary: string;
  sort_order: number;
  created_at: string;
}

export interface VideoDetail {
  video: Video;
  author: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  chapters: VideoChapter[];
}

export const videosAPI = {
  getVideos: (params?: { category?: string; limit?: number }) =>
    request<VideoWithAuthor[]>(
      `/videos${params ? `?${new URLSearchParams(params as any).toString()}` : ""}`
    ),

  getVideo: (id: number) => request<VideoDetail>(`/videos/${id}`),

  createVideo: (data: {
    title: string;
    description?: string;
    video_url: string;
    thumbnail?: string;
    duration?: number;
    category?: string;
    tags?: string[];
    is_public?: boolean;
  }) => request<Video>("/videos", { method: "POST", data }),

  updateVideo: (
    id: number,
    data: Partial<{
      title: string;
      description: string;
      video_url: string;
      thumbnail: string;
      duration: number;
      category: string;
      tags: string[];
      is_public: boolean;
    }>
  ) => request<Video>(`/videos/${id}`, { method: "PUT", data }),

  deleteVideo: (id: number) =>
    request<{ message: string }>(`/videos/${id}`, { method: "DELETE" }),

  likeVideo: (id: number) =>
    request<{ message: string }>(`/videos/${id}/like`, { method: "POST" }),

  unlikeVideo: (id: number) =>
    request<{ message: string }>(`/videos/${id}/like`, { method: "DELETE" }),

  bookmarkVideo: (id: number) =>
    request<{ message: string }>(`/videos/${id}/bookmark`, { method: "POST" }),

  unbookmarkVideo: (id: number) =>
    request<{ message: string }>(`/videos/${id}/bookmark`, { method: "DELETE" }),

  getChapters: (id: number) => request<VideoChapter[]>(`/videos/${id}/chapters`),

  incrementView: (id: number) =>
    request<{ views: number }>(`/videos/${id}/view`, { method: "POST" }),
};

export { APIError };
