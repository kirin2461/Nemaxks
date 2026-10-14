package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupStoriesTestDB поднимает in-memory SQLite и подменяет глобальный db
// (тот же паттерн, что в api_keys_test.go / handlers_max_test.go).
func setupStoriesTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	if err := gdb.AutoMigrate(
		&User{},
		&Story{},
		&StoryView{},
		&StoryPrivacyExclusion{},
		&Friend{},
		&Post{},
		&PostRating{},
		&PostLike{},
		&PostBookmark{},
		&Subscription{},
	); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	return gdb
}

// newStoryTestContext строит gin-контекст с user_id, как это делает authMiddleware.
func newStoryTestContext(method, target string, body string, userID uint) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	c.Request = req
	if userID > 0 {
		c.Set("user_id", float64(userID))
	}
	return c, w
}

func createStoryTestUser(t *testing.T, username string, privacyMode string) User {
	t.Helper()
	u := User{Username: username, Password: "x", StoryPrivacyMode: privacyMode}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user %s: %v", username, err)
	}
	return u
}

func createTestStory(t *testing.T, authorID uint) Story {
	t.Helper()
	s := Story{
		UserID:    authorID,
		Content:   "test story",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	if err := db.Create(&s).Error; err != nil {
		t.Fatalf("create story: %v", err)
	}
	return s
}

func getStoryIDs(t *testing.T, viewerID uint) []uint {
	t.Helper()
	c, w := newStoryTestContext(http.MethodGet, "/api/stories", "", viewerID)
	getStoriesHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getStoriesHandler: status=%d body=%s", w.Code, w.Body.String())
	}
	var stories []Story
	if err := json.Unmarshal(w.Body.Bytes(), &stories); err != nil {
		t.Fatalf("unmarshal stories: %v (body=%s)", err, w.Body.String())
	}
	ids := make([]uint, 0, len(stories))
	for _, s := range stories {
		ids = append(ids, s.ID)
	}
	return ids
}

func containsID(ids []uint, id uint) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

func viewStoryStatus(t *testing.T, storyID uint, viewerID uint) int {
	t.Helper()
	c, w := newStoryTestContext(http.MethodPost, "/api/stories/"+strconv.Itoa(int(storyID))+"/view", "", viewerID)
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(storyID))}}
	viewStoryHandler(c)
	return w.Code
}

// TestStoryPrivacyEveryoneIsDefault: режим по умолчанию сохраняет текущее
// поведение — истории видят все, кроме исключённых.
func TestStoryPrivacyEveryoneIsDefault(t *testing.T) {
	setupStoriesTestDB(t)

	author := createStoryTestUser(t, "author_default", "")
	stranger := createStoryTestUser(t, "stranger", "")
	excluded := createStoryTestUser(t, "excluded", "")
	story := createTestStory(t, author.ID)

	// Незнакомец видит историю (текущее поведение сохранено).
	if ids := getStoryIDs(t, stranger.ID); !containsID(ids, story.ID) {
		t.Fatalf("everyone: stranger should see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, stranger.ID); code != http.StatusOK {
		t.Fatalf("everyone: stranger view should be 200, got %d", code)
	}

	// Исключённый не видит даже в режиме everyone.
	if err := db.Create(&StoryPrivacyExclusion{UserID: author.ID, ExcludedUserID: excluded.ID}).Error; err != nil {
		t.Fatalf("create exclusion: %v", err)
	}
	if ids := getStoryIDs(t, excluded.ID); containsID(ids, story.ID) {
		t.Fatalf("everyone: excluded user must not see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, excluded.ID); code != http.StatusForbidden {
		t.Fatalf("everyone: excluded view should be 403, got %d", code)
	}
}

// TestStoryPrivacyFriendsMode: friends — истории видны только друзьям автора.
func TestStoryPrivacyFriendsMode(t *testing.T) {
	setupStoriesTestDB(t)

	author := createStoryTestUser(t, "author_friends", StoryPrivacyFriends)
	friend := createStoryTestUser(t, "friend", "")
	stranger := createStoryTestUser(t, "outsider", "")
	story := createTestStory(t, author.ID)

	// Дружба одной записью (как создаёт respondFriendRequestHandler).
	if err := db.Create(&Friend{UserID: author.ID, FriendID: friend.ID}).Error; err != nil {
		t.Fatalf("create friendship: %v", err)
	}

	// Не-друг не видит историю в списке и не может отметить просмотр.
	if ids := getStoryIDs(t, stranger.ID); containsID(ids, story.ID) {
		t.Fatalf("friends: stranger must not see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, stranger.ID); code != http.StatusForbidden {
		t.Fatalf("friends: stranger view should be 403, got %d", code)
	}

	// Друг видит историю (дружба проверяется в обе стороны).
	if ids := getStoryIDs(t, friend.ID); !containsID(ids, story.ID) {
		t.Fatalf("friends: friend should see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, friend.ID); code != http.StatusOK {
		t.Fatalf("friends: friend view should be 200, got %d", code)
	}

	// Автор всегда видит свою историю.
	if ids := getStoryIDs(t, author.ID); !containsID(ids, story.ID) {
		t.Fatalf("friends: author should see own story, got %v", ids)
	}
}

// TestStoryPrivacyFriendsExceptMode: friends_except — друзья, кроме исключённых.
func TestStoryPrivacyFriendsExceptMode(t *testing.T) {
	setupStoriesTestDB(t)

	author := createStoryTestUser(t, "author_fex", StoryPrivacyFriendsExcept)
	friend := createStoryTestUser(t, "friend_ok", "")
	excludedFriend := createStoryTestUser(t, "friend_excluded", "")
	stranger := createStoryTestUser(t, "outsider2", "")
	story := createTestStory(t, author.ID)

	for _, f := range []User{friend, excludedFriend} {
		if err := db.Create(&Friend{UserID: author.ID, FriendID: f.ID}).Error; err != nil {
			t.Fatalf("create friendship: %v", err)
		}
	}
	if err := db.Create(&StoryPrivacyExclusion{UserID: author.ID, ExcludedUserID: excludedFriend.ID}).Error; err != nil {
		t.Fatalf("create exclusion: %v", err)
	}

	// Обычный друг видит.
	if ids := getStoryIDs(t, friend.ID); !containsID(ids, story.ID) {
		t.Fatalf("friends_except: friend should see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, friend.ID); code != http.StatusOK {
		t.Fatalf("friends_except: friend view should be 200, got %d", code)
	}

	// Исключённый друг не видит.
	if ids := getStoryIDs(t, excludedFriend.ID); containsID(ids, story.ID) {
		t.Fatalf("friends_except: excluded friend must not see story, got %v", ids)
	}
	if code := viewStoryStatus(t, story.ID, excludedFriend.ID); code != http.StatusForbidden {
		t.Fatalf("friends_except: excluded friend view should be 403, got %d", code)
	}

	// Не-друг не видит.
	if ids := getStoryIDs(t, stranger.ID); containsID(ids, story.ID) {
		t.Fatalf("friends_except: stranger must not see story, got %v", ids)
	}
}

// TestStoryPrivacyModeEndpoints: GET/PUT /api/stories/privacy.
func TestStoryPrivacyModeEndpoints(t *testing.T) {
	setupStoriesTestDB(t)

	user := createStoryTestUser(t, "privacy_user", "")

	// Дефолт — everyone.
	c, w := newStoryTestContext(http.MethodGet, "/api/stories/privacy", "", user.ID)
	getStoryPrivacyHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GET privacy: status=%d", w.Code)
	}
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["mode"] != StoryPrivacyEveryone {
		t.Fatalf("default mode should be everyone, got %q", resp["mode"])
	}

	// Невалидный режим → 400.
	c, w = newStoryTestContext(http.MethodPut, "/api/stories/privacy", `{"mode":"nobody"}`, user.ID)
	updateStoryPrivacyHandler(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("PUT invalid mode: status=%d, want 400", w.Code)
	}

	// Валидный режим сохраняется и читается обратно.
	c, w = newStoryTestContext(http.MethodPut, "/api/stories/privacy", `{"mode":"friends"}`, user.ID)
	updateStoryPrivacyHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT friends: status=%d body=%s", w.Code, w.Body.String())
	}
	c, w = newStoryTestContext(http.MethodGet, "/api/stories/privacy", "", user.ID)
	getStoryPrivacyHandler(c)
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["mode"] != StoryPrivacyFriends {
		t.Fatalf("mode should persist as friends, got %q", resp["mode"])
	}
}

// TestFeedPrivacyFilter: лента постов учитывает story_privacy_mode автора.
func TestFeedPrivacyFilter(t *testing.T) {
	setupStoriesTestDB(t)

	author := createStoryTestUser(t, "feed_author", StoryPrivacyFriends)
	publicAuthor := createStoryTestUser(t, "feed_public", "")
	friend := createStoryTestUser(t, "feed_friend", "")
	stranger := createStoryTestUser(t, "feed_stranger", "")

	privatePost := Post{AuthorID: author.ID, Title: "private", Content: "friends only"}
	publicPost := Post{AuthorID: publicAuthor.ID, Title: "public", Content: "for all"}
	if err := db.Create(&privatePost).Error; err != nil {
		t.Fatalf("create private post: %v", err)
	}
	if err := db.Create(&publicPost).Error; err != nil {
		t.Fatalf("create public post: %v", err)
	}
	if err := db.Create(&Friend{UserID: friend.ID, FriendID: author.ID}).Error; err != nil {
		t.Fatalf("create friendship: %v", err)
	}

	getFeedIDs := func(viewerID uint) map[uint]bool {
		t.Helper()
		c, w := newStoryTestContext(http.MethodGet, "/api/posts", "", viewerID)
		getPostsHandler(c)
		if w.Code != http.StatusOK {
			t.Fatalf("getPostsHandler: status=%d body=%s", w.Code, w.Body.String())
		}
		var resp struct {
			Posts []struct {
				ID uint `json:"id"`
			} `json:"posts"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal posts: %v (body=%s)", err, w.Body.String())
		}
		ids := map[uint]bool{}
		for _, p := range resp.Posts {
			ids[p.ID] = true
		}
		return ids
	}

	// Не-друг: видит публичный пост, не видит пост friends-автора.
	ids := getFeedIDs(stranger.ID)
	if !ids[publicPost.ID] {
		t.Fatalf("feed: stranger should see public post")
	}
	if ids[privatePost.ID] {
		t.Fatalf("feed: stranger must not see friends-mode post")
	}

	// Друг видит оба поста.
	ids = getFeedIDs(friend.ID)
	if !ids[publicPost.ID] || !ids[privatePost.ID] {
		t.Fatalf("feed: friend should see both posts, got %v", ids)
	}

	// Автор видит свой пост.
	ids = getFeedIDs(author.ID)
	if !ids[privatePost.ID] {
		t.Fatalf("feed: author should see own post")
	}
}
