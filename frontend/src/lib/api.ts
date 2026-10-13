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
    request<{ user: User; access_token: string; refresh_token: string; expires_in: number; requires_2fa?: boolean }>("/auth/login", {
      method: "POST",
      data: { username, password },
    }).then((res) => {
      if (res.access_token) {
        localStorage.setItem("token", res.access_token);
        if (res.refresh_token) {
          localStorage.setItem("refresh_token", res.refresh_token);
        }
      }
      return res;
    }),

  register: (username: string, password: string) =>
    request<{ user: User; access_token: string; refresh_token: string; expires_in: number }>("/auth/register", {
      method: "POST",
      data: { username, password },
    }).then((res) => {
      if (res.access_token) {
        localStorage.setItem("token", res.access_token);
        if (res.refresh_token) {
          localStorage.setItem("refresh_token", res.refresh_token);
        }
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
      confirmation_url?: string;
      status?: string;
      test_mode?: boolean;
      message?: string;
    }>('/premium/checkout', {
      method: 'POST',
      data: { plan_id: planId },
    }),

  getQuota: () =>
    request<JarvisQuota>('/jarvis/quota'),
    
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

  markAllAsReadFromUser: (userId: string) =>
    request<{ marked_count: number }>(`/encryption/dm/${userId}/read`, {
      method: "POST",
    }),

  getUnreadCounts: () =>
    request<{ unread_counts: Array<{ sender_id: number; count: number }> }>("/encryption/dm/unread-counts"),
};

// Group DM API
export const groupDMAPI = {
  getGroups: () => request<any[]>("/group-dm"),

  createGroup: (name: string, participantIds: number[]) =>
    request<any>("/group-dm", {
      method: "POST",
      data: { name, participant_ids: participantIds },
    }),

  getMessages: (groupId: string, limit: number = 50, offset: number = 0) =>
    request<any[]>(`/group-dm/${groupId}/messages?limit=${limit}&offset=${offset}`),

  sendMessage: (groupId: string, content: string, replyToId?: number) =>
    request<any>(`/group-dm/${groupId}/messages`, {
      method: "POST",
      data: { content, reply_to_id: replyToId },
    }),

  addParticipant: (groupId: string, userId: number) =>
    request<any>(`/group-dm/${groupId}/participants`, {
      method: "POST",
      data: { user_id: userId },
    }),

  removeParticipant: (groupId: string, userId: string) =>
    request<any>(`/group-dm/${groupId}/participants/${userId}`, {
      method: "DELETE",
    }),

  updateGroup: (groupId: string, data: { name?: string; avatar?: string }) =>
    request<any>(`/group-dm/${groupId}`, {
      method: "PUT",
      data,
    }),
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

  sendTyping: (channelId?: string, chatUserId?: string, status: 'typing' | 'recording_voice' | 'stopped' = 'typing') =>
    request<{ status: string }>("/typing", {
      method: "POST",
      data: { channel_id: channelId, chat_user_id: chatUserId, status },
    }),
};

// Invites API
export const invitesAPI = {
  createInvite: (guildId?: string, maxUses?: number) =>
    request<InviteLink>("/invites", {
      method: "POST",
      data: { guild_id: guildId ? parseInt(guildId, 10) : undefined, max_uses: maxUses },
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

export interface SuperAdminStats {
  users: number;
  posts: number;
  messages: number;
  guilds: number;
  channels: number;
  stories: number;
  online_users: number;
  active_bans: number;
  pending_reports: number;
  today_messages: number;
  today_new_users: number;
  active_sessions: number;
}

export interface UserWithStatus {
  id: number;
  username: string;
  email?: string;
  role: string;
  avatar?: string;
  created_at: string;
  last_seen: string;
  is_banned: boolean;
  has_2fa: boolean;
}

export interface UserDetail {
  user: User;
  is_banned: boolean;
  has_2fa: boolean;
  stats: {
    posts: number;
    messages: number;
    guilds: number;
  };
  sessions: UserSession[];
  ban_history: BanHistory[];
}

export interface UserSession {
  id: string;
  user_id: number;
  device_info: string;
  ip_address: string;
  last_activity: string;
  is_active: boolean;
  expires_at: string;
}

export interface BanHistory {
  id: number;
  user_id: number;
  reason: string;
  banned_by: number;
  created_at: string;
  expires_at?: string;
}

export interface GuildWithStats {
  id: number;
  name: string;
  description: string;
  icon: string;
  owner_id: number;
  owner?: User;
  created_at: string;
  member_count: number;
  channel_count: number;
  message_count: number;
}

export interface ServiceStatus {
  services: {
    database: string;
    redis: string;
    livekit: string;
  };
  timestamp: string;
}

export interface JarvisStats {
  total_requests: number;
  today_requests: number;
  top_users: {
    user_id: number;
    username: string;
    requests: number;
  }[];
}

export const superAdminAPI = {
  getStats: () => request<SuperAdminStats>("/super-admin/stats"),

  getUsers: (page = 1, limit = 50, search = "", role = "", status = "") =>
    request<{ users: UserWithStatus[]; total: number; page: number; limit: number }>(
      `/super-admin/users?page=${page}&limit=${limit}&search=${search}&role=${role}&status=${status}`,
    ),

  getUserDetail: (userId: number) =>
    request<UserDetail>(`/super-admin/users/${userId}`),

  getUserSessions: (userId: number) =>
    request<{ sessions: UserSession[] }>(`/super-admin/users/${userId}/sessions`),

  revokeSession: (userId: number, sessionId: string) =>
    request<{ message: string }>(`/super-admin/users/${userId}/sessions/${sessionId}`, {
      method: "DELETE",
    }),

  revokeAllSessions: (userId: number) =>
    request<{ message: string }>(`/super-admin/users/${userId}/sessions`, {
      method: "DELETE",
    }),

  resetPassword: (userId: number) =>
    request<{ message: string; temp_password: string }>(`/super-admin/users/${userId}/reset-password`, {
      method: "POST",
    }),

  changeRole: (userId: number, role: string) =>
    request<{ message: string; old_role: string; new_role: string }>(`/super-admin/users/${userId}/role`, {
      method: "PUT",
      data: { role },
    }),

  getGuilds: (page = 1, limit = 50, search = "") =>
    request<{ guilds: GuildWithStats[]; total: number; page: number; limit: number }>(
      `/super-admin/guilds?page=${page}&limit=${limit}&search=${search}`,
    ),

  getGuildDetail: (guildId: number) =>
    request<{ guild: any; stats: any; channels: any[]; recent_members: any[] }>(`/super-admin/guilds/${guildId}`),

  transferGuild: (guildId: number, newOwnerId: number) =>
    request<{ message: string }>(`/super-admin/guilds/${guildId}/transfer`, {
      method: "POST",
      data: { new_owner_id: newOwnerId },
    }),

  deleteGuild: (guildId: number) =>
    request<{ message: string }>(`/super-admin/guilds/${guildId}`, {
      method: "DELETE",
    }),

  getSecurityLogs: (page = 1, limit = 100, eventType = "") =>
    request<{ logs: AuditLog[]; total: number }>(`/super-admin/security-logs?page=${page}&limit=${limit}&event_type=${eventType}`),

  getFailedLogins: () =>
    request<{ logs: AuditLog[] }>("/super-admin/failed-logins"),

  getServiceStatus: () =>
    request<ServiceStatus>("/super-admin/service-status"),

  getJarvisStats: () =>
    request<JarvisStats>("/super-admin/jarvis/stats"),

  getJarvisUserUsage: (userId: number) =>
    request<{ user: string; total_requests: number; today_requests: number; recent_sessions: any[] }>(`/super-admin/jarvis/users/${userId}`),

  deleteMessage: (messageId: number, type: "dm" | "channel") =>
    request<{ message: string }>(`/super-admin/messages/${messageId}?type=${type}`, {
      method: "DELETE",
    }),

  deletePost: (postId: number) =>
    request<{ message: string }>(`/super-admin/posts/${postId}`, {
      method: "DELETE",
    }),

  getBanners: () =>
    request<{ banners: NotificationBanner[] }>("/super-admin/banners"),

  createBanner: (data: { title: string; message: string; type?: string; expires_at?: string }) =>
    request<{ banner: NotificationBanner }>("/super-admin/banners", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBanner: (bannerId: number, data: { title?: string; message?: string; type?: string; is_active?: boolean; expires_at?: string }) =>
    request<{ banner: NotificationBanner }>(`/super-admin/banners/${bannerId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteBanner: (bannerId: number) =>
    request<{ message: string }>(`/super-admin/banners/${bannerId}`, {
      method: "DELETE",
    }),
};

export interface NotificationBanner {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_active: boolean;
  expires_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator?: { id: number; username: string; avatar?: string };
}

export const getActiveBanners = () =>
  request<{ banners: NotificationBanner[] }>("/banners/active");

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
      data: { content },
    }),

  updatePost: (postId: string, data: { content?: string; tags?: string[] }) =>
    request<Post>(`/posts/${postId}`, {
      method: "PUT",
      data,
    }),

  getPopularTags: (limit?: number) =>
    request<{ tags: { name: string; count: number }[] }>(`/posts/tags/popular${limit ? `?limit=${limit}` : ''}`),
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
  id?: number;
  user_id?: number;
  theme: string;
  language: string;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  voice_enabled: boolean;
  noise_reduction: boolean;
  telegram_notifications: boolean;
  openai_key: string;
  deepseek_key: string;
  huggingface_key: string;
  jarvis_personality: string;
  jarvis_wake_word: string;
  profile_visibility: string;
  message_privacy: string;
}

export interface Friend {
  id: string;
  username: string;
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
  premium?: UserPremiumInfo;
}

export interface UserPremiumInfo {
  active: boolean;
  plan_name?: string;
  tier?: string;
  expires_at?: string;
}

export interface JarvisQuota {
  limit: number;
  used: number;
  remaining: number;
  premium: boolean;
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
  quality?: '720p' | '1080p';
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

export interface ChannelTool {
  id: number;
  channel_id: number;
  tool_type: "board" | "notebook";
  title: string;
  content: string;
  owner_id: number;
  visible_to: "all" | "moderators" | "owner";
  created_at: number;
  updated_at: number;
}

export const channelToolsAPI = {
  getTools: (channelId: number) =>
    request<ChannelTool[]>(`/channels/${channelId}/tools`),

  createTool: (channelId: number, data: { type: "board" | "notebook"; title: string; visible_to?: string }) =>
    request<ChannelTool>(`/channels/${channelId}/tools`, { method: "POST", data }),

  updateTool: (toolId: number, data: { title?: string; content?: string; visible_to?: string }) =>
    request<ChannelTool>(`/channels/tools/${toolId}`, { method: "PUT", data }),

  deleteTool: (toolId: number) =>
    request<{ status: string }>(`/channels/tools/${toolId}`, { method: "DELETE" }),
};

// Phase 1: Achievements, Levels, Polls, Custom Statuses, Disappearing Messages

export interface Achievement {
  id: number;
  name: string;
  name_ru: string;
  description: string;
  description_ru: string;
  icon: string;
  category: string;
  xp_reward: number;
  rarity: string;
  condition: string;
  threshold: number;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement_id: number;
  unlocked_at: string;
  achievement: Achievement;
}

export interface UserLevel {
  level: number;
  current_xp: number;
  total_xp: number;
  xp_needed: number;
  progress: number;
  messages: number;
  voice_mins: number;
  reactions: number;
  posts: number;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  avatar: string;
  level: number;
  total_xp: number;
  rank: number;
}

export interface Poll {
  id: number;
  channel_id?: number;
  guild_id?: number;
  author_id: number;
  question: string;
  description: string;
  multi_choice: boolean;
  anonymous: boolean;
  expires_at?: string;
  is_closed: boolean;
  created_at: string;
  author: User;
  options: PollOption[];
  votes_count: number;
}

export interface PollOption {
  id: number;
  poll_id: number;
  text: string;
  position: number;
  votes_count: number;
}

export interface CustomStatus {
  text: string;
  emoji: string;
  expires_at?: string;
}

export interface StatusPreset {
  id?: number;
  name: string;
  text: string;
  emoji: string;
}

export interface DisappearingSettings {
  enabled: boolean;
  duration: number;
}

export const achievementsAPI = {
  getAll: () => request<Achievement[]>('/achievements'),
  getUserAchievements: (userId: number | string) => 
    request<UserAchievement[]>(`/achievements/${userId}`),
  getUserLevel: (userId: number | string) => 
    request<UserLevel>(`/level/${userId}`),
  getLeaderboard: (scope?: string, period?: string) => {
    const params = new URLSearchParams();
    if (scope) params.append('scope', scope);
    if (period) params.append('period', period);
    return request<LeaderboardEntry[]>(`/leaderboard?${params}`);
  },
};

export const pollsAPI = {
  create: (data: {
    channel_id?: number;
    guild_id?: number;
    question: string;
    description?: string;
    options: string[];
    multi_choice?: boolean;
    anonymous?: boolean;
    duration?: number;
  }) => request<Poll>('/polls', { method: 'POST', data }),
  
  getPolls: (channelId?: number, guildId?: number, active?: boolean) => {
    const params = new URLSearchParams();
    if (channelId) params.append('channel_id', channelId.toString());
    if (guildId) params.append('guild_id', guildId.toString());
    if (active !== undefined) params.append('active', active.toString());
    return request<Poll[]>(`/polls?${params}`);
  },
  
  getPoll: (id: number) => 
    request<{ poll: Poll; my_votes: number[] }>(`/polls/${id}`),
  
  vote: (id: number, optionIds: number[]) => 
    request<{ message: string }>(`/polls/${id}/vote`, { 
      method: 'POST', 
      data: { option_ids: optionIds } 
    }),
  
  close: (id: number) => 
    request<{ message: string }>(`/polls/${id}/close`, { method: 'POST' }),
};

export const statusAPI = {
  get: (userId: number | string) => 
    request<CustomStatus>(`/status/${userId}`),
  
  update: (data: { text: string; emoji: string; duration?: number }) => 
    request<CustomStatus>('/status', { method: 'PUT', data }),
  
  clear: () => 
    request<{ message: string }>('/status', { method: 'DELETE' }),
  
  getPresets: () => 
    request<{ custom: StatusPreset[]; default: StatusPreset[] }>('/status-presets'),
  
  createPreset: (data: { name: string; text: string; emoji: string }) => 
    request<StatusPreset>('/status-presets', { method: 'POST', data }),
  
  deletePreset: (id: number) => 
    request<{ message: string }>(`/status-presets/${id}`, { method: 'DELETE' }),
};

export const disappearingAPI = {
  getSettings: (userId: number) => 
    request<DisappearingSettings>(`/disappearing/${userId}`),
  
  updateSettings: (userId: number, data: { enabled: boolean; duration: number }) => 
    request<DisappearingSettings>(`/disappearing/${userId}`, { method: 'PUT', data }),
};

export interface VirtualCurrency {
  id: number;
  user_id: number;
  coins: number;
  gems: number;
}

export interface ShopItem {
  id: number;
  name: string;
  name_ru: string;
  description: string;
  description_ru: string;
  type: string;
  category: string;
  price_coins: number;
  price_gems: number;
  rarity: string;
  image_url: string;
}

export interface UserInventory {
  id: number;
  user_id: number;
  item_id: number;
  is_equipped: boolean;
  acquired_at: string;
  item: ShopItem;
}

export interface Challenge {
  id: number;
  name: string;
  name_ru: string;
  description: string;
  description_ru: string;
  type: string;
  category: string;
  condition: string;
  target: number;
  xp_reward: number;
  coin_reward: number;
  gem_reward: number;
  reset_period: string;
  is_active: boolean;
  progress?: number;
  is_completed?: boolean;
  completed_at?: string;
}

export interface UserStreak {
  id: number;
  user_id: number;
  login_streak: number;
  max_login_streak: number;
  message_streak: number;
  max_message_streak: number;
  last_login_date?: string;
  last_message_date?: string;
}

export interface GuildCompetition {
  id: number;
  name: string;
  name_ru: string;
  description: string;
  description_ru: string;
  type: string;
  metric: string;
  starts_at: string;
  ends_at: string;
  prizes: string;
  is_active: boolean;
}

export interface GuildCompetitionEntry {
  id: number;
  competition_id: number;
  guild_id: number;
  score: number;
  rank: number;
  guild?: { name: string; icon?: string };
}

export interface Badge {
  id: number;
  name: string;
  name_ru: string;
  description: string;
  description_ru: string;
  icon: string;
  rarity: string;
  is_special: boolean;
}

export interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  acquired_at: string;
  badge: Badge;
}

export interface UserProfileCustomization {
  id: number;
  user_id: number;
  theme_id?: number;
  frame_id?: number;
  banner_id?: number;
  badge_ids: string;
  profile_color: string;
  bio: string;
  show_level: boolean;
  show_achievements: boolean;
  show_activity: boolean;
}

export const currencyAPI = {
  get: () => request<VirtualCurrency>('/currency'),
};

export const shopAPI = {
  getItems: (category?: string, type?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (type) params.append('type', type);
    return request<ShopItem[]>(`/shop?${params}`);
  },
  
  purchase: (id: number, payWith: 'coins' | 'gems' = 'coins') =>
    request<{ message: string; item: ShopItem; balance: VirtualCurrency }>(`/shop/${id}/purchase`, {
      method: 'POST',
      data: { pay_with: payWith },
    }),
};

export const inventoryAPI = {
  get: () => request<UserInventory[]>('/inventory'),
  
  equip: (id: number) =>
    request<{ message: string }>(`/inventory/${id}/equip`, { method: 'POST' }),
};

export const challengesAPI = {
  getAll: (type?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    return request<Challenge[]>(`/challenges?${params}`);
  },
  
  claim: (id: number) =>
    request<{ message: string }>(`/challenges/${id}/claim`, { method: 'POST' }),
};

export const streaksAPI = {
  get: () => request<UserStreak>('/streaks'),
  
  claimDailyReward: () =>
    request<{ claimed: boolean; streak: number; reward: { coins: number; xp: number; gems?: number } }>('/daily-reward', { method: 'POST' }),
  
  spinWheel: () =>
    request<{ prize: { name: string; coins: number; gems: number; xp: number }; balance: VirtualCurrency }>('/spin-wheel', { method: 'POST' }),
};

export const competitionsAPI = {
  getAll: (status?: 'active' | 'upcoming' | 'ended') => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return request<GuildCompetition[]>(`/competitions?${params}`);
  },
  
  get: (id: number) =>
    request<{ competition: GuildCompetition; leaderboard: GuildCompetitionEntry[] }>(`/competitions/${id}`),
  
  join: (id: number, guildId: number) =>
    request<{ message: string }>(`/competitions/${id}/join`, {
      method: 'POST',
      data: { guild_id: guildId },
    }),
};

export const profileCustomizationAPI = {
  get: (userId?: number | string) =>
    request<{ profile: UserProfileCustomization; equipped_items: UserInventory[]; badges: UserBadge[] }>(`/profile/${userId || 'me'}/customization`),
  
  update: (data: Partial<{
    bio: string;
    profile_color: string;
    show_level: boolean;
    show_achievements: boolean;
    show_activity: boolean;
  }>) => request<UserProfileCustomization>('/profile/customization', { method: 'PUT', data }),
};

export const badgesAPI = {
  getAll: () => request<Badge[]>('/badges'),
  
  getUserBadges: (userId: number | string) =>
    request<UserBadge[]>(`/badges/${userId}`),
};

export const guildLeaderboardAPI = {
  get: (guildId: number, period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return request<LeaderboardEntry[]>(`/guild-leaderboard/${guildId}?${params}`);
  },
};

export const levelRewardsAPI = {
  get: () => request<{ level: number; coins: number; gems?: number; unlock?: string; description: string }[]>('/level-rewards'),
};

// ============= PHASE 3 APIs =============

// Gift System
export interface UserGift {
  id: number;
  sender_id: number;
  receiver_id: number;
  item_id: number;
  message: string;
  is_opened: boolean;
  opened_at?: string;
  created_at: string;
  sender?: { id: number; username: string; avatar?: string };
  item?: ShopItem;
}

export const giftsAPI = {
  send: (receiverId: number, itemId: number, message?: string) =>
    request<UserGift>('/gifts/send', { method: 'POST', data: { receiver_id: receiverId, item_id: itemId, message } }),
  getReceived: () => request<UserGift[]>('/gifts/received'),
  open: (id: number) => request<UserGift>(`/gifts/${id}/open`, { method: 'POST' }),
};

// Trading System
export interface Trade {
  id: number;
  initiator_id: number;
  receiver_id: number;
  status: string;
  initiator_note: string;
  receiver_note: string;
  expires_at: string;
  completed_at?: string;
  created_at: string;
  initiator?: { id: number; username: string; avatar?: string };
  receiver?: { id: number; username: string; avatar?: string };
}

export const tradesAPI = {
  create: (tradeData: { receiver_id: number; offer_items?: number[]; offer_coins?: number; request_items?: number[]; request_coins?: number; note?: string }) =>
    request<Trade>('/trades', { method: 'POST', data: tradeData }),
  getAll: (status?: string) => request<Trade[]>(`/trades${status ? `?status=${status}` : ''}`),
  respond: (id: number, action: 'accept' | 'reject', note?: string) =>
    request<Trade>(`/trades/${id}/respond`, { method: 'POST', data: { action, note } }),
};

// Activity Feed
export interface ActivityFeedItem {
  id: number;
  user_id: number;
  actor_id: number;
  action_type: string;
  target_type: string;
  target_id: number;
  metadata?: string;
  is_read: boolean;
  created_at: string;
  actor?: { id: number; username: string; avatar?: string };
}

export const activityFeedAPI = {
  get: (limit?: number) => request<ActivityFeedItem[]>(`/activity-feed${limit ? `?limit=${limit}` : ''}`),
  markRead: (id: number) => request<{ success: boolean }>(`/activity-feed/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<{ success: boolean }>('/activity-feed/read-all', { method: 'POST' }),
};

// Enhanced Friends
export interface BestFriend {
  id: number;
  user_id: number;
  friend_id: number;
  score: number;
  rank: number;
  friend?: { id: number; username: string; avatar?: string };
}

export const enhancedFriendsAPI = {
  getBestFriends: () => request<BestFriend[]>('/friends/best'),
  getInteractions: () => request<{ user_id: number; friend_id: number; interaction_type: string; count: number }[]>('/friends/interactions'),
};

// Events System
export interface GameEvent {
  id: number;
  name: string;
  description: string;
  event_type: string;
  theme: string;
  banner_url: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  coin_bonus: number;
  xp_bonus: number;
}

export interface EventReward {
  id: number;
  event_id: number;
  name: string;
  description: string;
  reward_type: string;
  reward_value: number;
  requirement: string;
  threshold: number;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: number;
  points: number;
  rank: number;
  user?: { id: number; username: string; avatar?: string };
}

export const eventsAPI = {
  getAll: (activeOnly?: boolean) => request<GameEvent[]>(`/events${activeOnly ? '?active=true' : ''}`),
  get: (id: number) => request<{ event: GameEvent; rewards: EventReward[] }>(`/events/${id}`),
  join: (id: number) => request<EventParticipant>(`/events/${id}/join`, { method: 'POST' }),
  getLeaderboard: (id: number, limit?: number) => request<EventParticipant[]>(`/events/${id}/leaderboard${limit ? `?limit=${limit}` : ''}`),
  claimReward: (eventId: number, rewardId: number) => request<{ success: boolean; reward: EventReward }>(`/events/${eventId}/rewards/${rewardId}/claim`, { method: 'POST' }),
};

// Clans
export interface Clan {
  id: number;
  guild_id: number;
  name: string;
  description: string;
  icon_url: string;
  color: string;
  leader_id: number;
  max_members: number;
  total_xp: number;
  is_public: boolean;
  leader?: { id: number; username: string; avatar?: string };
}

export interface ClanChallenge {
  id: number;
  clan_id: number;
  name: string;
  description: string;
  goal: number;
  progress: number;
  reward_coins: number;
  reward_xp: number;
  is_completed: boolean;
  expires_at?: string;
}

export const clansAPI = {
  getGuildClans: (guildId: number) => request<Clan[]>(`/guild-clans/${guildId}`),
  create: (clanData: { guild_id: number; name: string; description?: string; color?: string; is_public?: boolean }) =>
    request<Clan>('/clans', { method: 'POST', data: clanData }),
  join: (id: number) => request<{ clan_id: number; user_id: number }>(`/clans/${id}/join`, { method: 'POST' }),
  getChallenges: (id: number) => request<ClanChallenge[]>(`/clans/${id}/challenges`),
};

// Mini-Games
export interface MiniGame {
  id: number;
  name: string;
  description: string;
  game_type: string;
  difficulty: string;
  coin_reward: number;
  xp_reward: number;
  cooldown_min: number;
}

export interface GameSession {
  id: number;
  game_id: number;
  user_id: number;
  score: number;
  high_score: number;
  coins_earned: number;
  xp_earned: number;
}

export interface TriviaQuestion {
  id: number;
  question: string;
  options: string;
  correct_idx: number;
  category: string;
  difficulty: string;
  points: number;
}

export const miniGamesAPI = {
  getAll: () => request<MiniGame[]>('/minigames'),
  start: (id: number) => request<{ session: GameSession; game: MiniGame; game_data?: TriviaQuestion[] }>(`/minigames/${id}/start`, { method: 'POST' }),
  complete: (sessionId: number, score: number) =>
    request<{ session: GameSession; coins_earned: number; xp_earned: number }>(`/minigames/session/${sessionId}/complete`, { method: 'POST', data: { score } }),
};

// Quest Chains
export interface QuestChain {
  id: number;
  name: string;
  description: string;
  category: string;
  total_steps: number;
  final_reward: string;
  is_active: boolean;
}

export interface QuestStep {
  id: number;
  chain_id: number;
  step_order: number;
  name: string;
  description: string;
  action_type: string;
  requirement: number;
  reward_coins: number;
  reward_xp: number;
  reward_gems: number;
}

export interface UserQuestProgress {
  id: number;
  user_id: number;
  chain_id: number;
  current_step: number;
  step_progress: number;
  is_completed: boolean;
  started_at: string;
  completed_at?: string;
  chain?: QuestChain;
}

export const questsAPI = {
  getAll: () => request<QuestChain[]>('/quests'),
  getMy: () => request<UserQuestProgress[]>('/quests/my'),
  start: (id: number) => request<{ progress: UserQuestProgress; current_step: QuestStep }>(`/quests/${id}/start`, { method: 'POST' }),
  getSteps: (id: number) => request<QuestStep[]>(`/quests/${id}/steps`),
};

// Mentorship
export interface Mentorship {
  id: number;
  mentor_id: number;
  mentee_id: number;
  status: string;
  mentor_xp: number;
  mentee_level: number;
  tasks_done: number;
  started_at: string;
  completed_at?: string;
  mentor?: { id: number; username: string; avatar?: string; level?: number };
  mentee?: { id: number; username: string; avatar?: string };
}

export const mentorshipAPI = {
  getMentors: () => request<{ id: number; username: string; avatar?: string; level: number }[]>('/mentors'),
  request: (mentorId: number) => request<Mentorship>(`/mentors/${mentorId}/request`, { method: 'POST' }),
  getMy: () => request<{ mentorship: Mentorship; tasks: unknown[]; progress: unknown[] }>('/mentorship'),
};

// Trending & Recommendations
export interface TrendingContent {
  id: number;
  content_type: string;
  content_id: number;
  score: number;
  views: number;
  likes: number;
  comments: number;
}

export interface UserRecommendation {
  id: number;
  user_id: number;
  content_type: string;
  content_id: number;
  reason: string;
  score: number;
  is_viewed: boolean;
}

export const trendingAPI = {
  get: (type?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (limit) params.append('limit', limit.toString());
    return request<TrendingContent[]>(`/trending?${params}`);
  },
  getRecommendations: (type?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (limit) params.append('limit', limit.toString());
    return request<UserRecommendation[]>(`/recommendations?${params}`);
  },
  dismissRecommendation: (id: number) => request<{ success: boolean }>(`/recommendations/${id}/dismiss`, { method: 'POST' }),
};

// Collections
export interface Collection {
  id: number;
  user_id: number;
  name: string;
  description: string;
  icon_emoji: string;
  is_private: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  id: number;
  collection_id: number;
  content_type: string;
  content_id: number;
  note: string;
  added_at: string;
}

export const collectionsAPI = {
  getAll: () => request<Collection[]>('/collections'),
  create: (collectionData: { name: string; description?: string; icon_emoji?: string; is_private?: boolean }) =>
    request<Collection>('/collections', { method: 'POST', data: collectionData }),
  addItem: (id: number, contentType: string, contentId: number, note?: string) =>
    request<CollectionItem>(`/collections/${id}/items`, { method: 'POST', data: { content_type: contentType, content_id: contentId, note } }),
  getItems: (id: number) => request<{ collection: Collection; items: CollectionItem[] }>(`/collections/${id}/items`),
  removeItem: (collectionId: number, itemId: number) => request<{ success: boolean }>(`/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' }),
  delete: (id: number) => request<{ success: boolean }>(`/collections/${id}`, { method: 'DELETE' }),
};

// Anti-Fraud System
export interface FraudStats {
  total_alerts: number;
  pending_alerts: number;
  alerts_today: number;
  impersonation_bans: number;
  blocked_ips: number;
  banned_devices: number;
  high_risk_users: number;
  average_risk_score: number;
}

export interface FraudAlert {
  id: number;
  user_id: number;
  alert_type: string;
  severity: string;
  description: string;
  evidence: string;
  source_ip: string;
  device_fingerprint: string;
  status: string;
  action_taken: string;
  reviewed_by?: number;
  reviewed_at?: string;
  review_notes: string;
  created_at: string;
  user?: { id: number; username: string };
}

export interface FraudRule {
  id: number;
  name: string;
  description: string;
  rule_type: string;
  condition: string;
  action: string;
  severity: string;
  is_active: boolean;
  priority: number;
}

export interface UserRiskScore {
  id: number;
  user_id: number;
  score: number;
  spam_score: number;
  phishing_score: number;
  impersonation_score: number;
  scam_score: number;
  behavior_score: number;
  total_alerts: number;
  total_warnings: number;
  total_mutes: number;
  total_bans: number;
  user?: { id: number; username: string };
}

export interface ImpersonationBan {
  id: number;
  user_id: number;
  username: string;
  detected_keywords: string;
  original_message: string;
  normalized_message: string;
  source_ip: string;
  device_fingerprint: string;
  banned_at: string;
  banned_by: string;
}

export const fraudAPI = {
  getStats: () => request<FraudStats>('/fraud/stats'),
  getAlerts: (page = 1, limit = 20, status?: string, type?: string, severity?: string) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    if (type) params.append('type', type);
    if (severity) params.append('severity', severity);
    return request<{ alerts: FraudAlert[]; total: number }>(`/fraud/alerts?${params}`);
  },
  getAlert: (id: number) => request<FraudAlert>(`/fraud/alerts/${id}`),
  reviewAlert: (id: number, status: string, action: string, notes: string) =>
    request<FraudAlert>(`/fraud/alerts/${id}/review`, { method: 'PUT', data: { status, action_taken: action, notes } }),
  getRules: () => request<FraudRule[]>('/fraud/rules'),
  createRule: (rule: Partial<FraudRule>) => request<FraudRule>('/fraud/rules', { method: 'POST', data: rule }),
  updateRule: (id: number, rule: Partial<FraudRule>) => request<FraudRule>(`/fraud/rules/${id}`, { method: 'PUT', data: rule }),
  deleteRule: (id: number) => request<{ success: boolean }>(`/fraud/rules/${id}`, { method: 'DELETE' }),
  getRiskScores: (minScore = 0, limit = 50) => request<UserRiskScore[]>(`/fraud/risk-scores?min_score=${minScore}&limit=${limit}`),
  getUserRiskScore: (userId: number) => request<UserRiskScore>(`/fraud/risk-scores/${userId}`),
  getImpersonationBans: (page = 1, limit = 20) =>
    request<{ bans: ImpersonationBan[]; total: number }>(`/fraud/impersonation-bans?page=${page}&limit=${limit}`),
  analyzeContent: (content: string) =>
    request<{ original: string; normalized: string; results: any[]; is_fraud: boolean }>('/fraud/analyze', { method: 'POST', data: { content } }),
};

// License System
export interface LicensePricing {
  type: string;
  duration_days: number;
  price_rub: number;
  price_usd: number;
  label: string;
  label_ru: string;
  description: string;
  description_ru: string;
  popular: boolean;
}

export interface LicenseKey {
  id: number;
  key: string;
  type: string;
  duration_days: number;
  price_rub: number;
  price_usd: number;
  is_used: boolean;
  used_by?: number;
  used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface UserLicense {
  id: number;
  user_id: number;
  type: string;
  activated_at: string;
  expires_at: string;
  is_active: boolean;
  days_remaining?: number;
}

export interface AdRequest {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  target_url: string;
  image_url: string;
  status: string;
  reviewed_by?: number;
  reviewed_at?: string;
  review_note: string;
  price_coins?: number;
  price_rub?: number;
  duration_days?: number;
  starts_at?: string;
  ends_at?: string;
  impressions: number;
  clicks: number;
  created_at: string;
  user?: { id: number; username: string };
}

export interface SystemAd {
  id: number;
  title: string;
  content: string;
  image_url: string;
  target_url: string;
  type: string;
  is_active: boolean;
  impressions: number;
  clicks: number;
}

export const licenseAPI = {
  getPricing: () => request<{ pricing: LicensePricing[]; benefits: string[]; benefits_ru: string[] }>('/license/pricing'),
  validate: (key: string) => request<{ valid: boolean; type?: string; duration_days?: number; error?: string }>('/license/validate', { method: 'POST', data: { key } }),
  activate: (key: string) => request<{ success: boolean; license: UserLicense }>('/license/activate', { method: 'POST', data: { key } }),
  getStatus: () => request<{ has_license: boolean; is_active: boolean; type?: string; expires_at?: string; days_remaining?: number }>('/license/status'),
};

export const adsAPI = {
  getSystemAds: () => request<SystemAd[]>('/ads/system'),
  recordClick: (id: number) => request<{ success: boolean }>(`/ads/${id}/click`, { method: 'POST' }),
  createRequest: (reqData: { type: string; title: string; content: string; target_url?: string; image_url?: string }) =>
    request<AdRequest>('/ads/request', { method: 'POST', data: reqData }),
  getMyRequests: () => request<AdRequest[]>('/ads/my-requests'),
};

export const adminLicenseAPI = {
  getAll: (page = 1, limit = 50) => request<{ licenses: LicenseKey[]; total: number }>(`/admin/licenses?page=${page}&limit=${limit}`),
  generate: (type: string) => request<LicenseKey>('/admin/licenses/generate', { method: 'POST', data: { type } }),
  generateBatch: (type: string, count: number) => request<{ licenses: LicenseKey[]; count: number }>('/admin/licenses/generate-batch', { method: 'POST', data: { type, count } }),
  getStats: () => request<{ total_keys: number; used_keys: number; unused_keys: number; active_users: number; revenue_rub: number }>('/admin/licenses/stats'),
};

export const adminAdsAPI = {
  getRequests: (status?: string, page = 1, limit = 20) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    return request<{ requests: AdRequest[]; total: number }>(`/admin/ads/requests?${params}`);
  },
  getRequest: (id: number) => request<AdRequest>(`/admin/ads/requests/${id}`),
  reviewRequest: (id: number, reviewData: { status: string; review_note?: string; price_coins?: number; price_rub?: number; duration_days?: number }) =>
    request<AdRequest>(`/admin/ads/requests/${id}/review`, { method: 'PUT', data: reviewData }),
  getSystemAds: () => request<SystemAd[]>('/admin/ads/system'),
  createSystemAd: (ad: Partial<SystemAd>) => request<SystemAd>('/admin/ads/system', { method: 'POST', data: ad }),
  updateSystemAd: (id: number, ad: Partial<SystemAd>) => request<SystemAd>(`/admin/ads/system/${id}`, { method: 'PUT', data: ad }),
  deleteSystemAd: (id: number) => request<{ success: boolean }>(`/admin/ads/system/${id}`, { method: 'DELETE' }),
};

export { APIError };
