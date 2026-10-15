package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupVideoTestDB поднимает in-memory SQLite и подменяет глобальный db
// (тот же паттерн, что в handlers_stories_test.go / handlers_calls_test.go).
func setupVideoTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	// sqlite ":memory:" живёт per-connection
	if sqlDB, err := gdb.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := gdb.AutoMigrate(&User{}, &Video{}, &VideoChapter{}, &VideoLike{}, &VideoBookmark{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	return gdb
}

func createVideoTestUser(t *testing.T, username, role string) User {
	t.Helper()
	u := User{Username: username, Password: "x", Role: role}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user %s: %v", username, err)
	}
	return u
}

func createTestVideo(t *testing.T, authorID uint) Video {
	t.Helper()
	v := Video{
		AuthorID: authorID,
		Title:    "test video",
		VideoURL: "https://cdn.example.com/v.mp4",
		IsPublic: true,
	}
	if err := db.Create(&v).Error; err != nil {
		t.Fatalf("create video: %v", err)
	}
	return v
}

func deleteVideoRequest(t *testing.T, videoID uint, userID uint) (*httptest.ResponseRecorder, map[string]string) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/videos/"+strconv.Itoa(int(videoID)), nil)
	if userID > 0 {
		c.Set("user_id", float64(userID))
	}
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(videoID))}}
	deleteVideoHandler(c)
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v (body=%s)", err, w.Body.String())
	}
	return w, resp
}

// TestDeleteVideoHandler — автор удаляет своё видео, чужой получает 403,
// несуществующее видео — 404, админ может удалить чужое.
func TestDeleteVideoHandler(t *testing.T) {
	setupVideoTestDB(t)

	author := createVideoTestUser(t, "video_author", "user")
	stranger := createVideoTestUser(t, "video_stranger", "user")
	admin := createVideoTestUser(t, "video_admin", "admin")

	// Автор удаляет своё видео → 200, связанные записи тоже удаляются.
	video := createTestVideo(t, author.ID)
	if err := db.Create(&VideoChapter{VideoID: video.ID, Title: "ch1"}).Error; err != nil {
		t.Fatalf("create chapter: %v", err)
	}
	w, resp := deleteVideoRequest(t, video.ID, author.ID)
	if w.Code != http.StatusOK {
		t.Fatalf("author delete: status=%d body=%s", w.Code, w.Body.String())
	}
	if resp["message"] != "Видео удалено" {
		t.Fatalf("author delete: unexpected message %q", resp["message"])
	}
	var count int64
	db.Model(&Video{}).Where("id = ?", video.ID).Count(&count)
	if count != 0 {
		t.Fatalf("video should be deleted, count=%d", count)
	}
	db.Model(&VideoChapter{}).Where("video_id = ?", video.ID).Count(&count)
	if count != 0 {
		t.Fatalf("chapters should be deleted, count=%d", count)
	}

	// Чужой пользователь → 403, видео остаётся.
	video2 := createTestVideo(t, author.ID)
	w, resp = deleteVideoRequest(t, video2.ID, stranger.ID)
	if w.Code != http.StatusForbidden {
		t.Fatalf("stranger delete: status=%d, want 403", w.Code)
	}
	if resp["error"] != "Удалять видео может только автор" {
		t.Fatalf("stranger delete: unexpected error %q", resp["error"])
	}
	db.Model(&Video{}).Where("id = ?", video2.ID).Count(&count)
	if count != 1 {
		t.Fatalf("video must remain after 403, count=%d", count)
	}

	// Несуществующее видео → 404.
	w, resp = deleteVideoRequest(t, 99999, author.ID)
	if w.Code != http.StatusNotFound {
		t.Fatalf("missing video: status=%d, want 404", w.Code)
	}
	if resp["error"] != "Видео не найдено" {
		t.Fatalf("missing video: unexpected error %q", resp["error"])
	}

	// Админ удаляет чужое видео → 200.
	w, _ = deleteVideoRequest(t, video2.ID, admin.ID)
	if w.Code != http.StatusOK {
		t.Fatalf("admin delete: status=%d, want 200", w.Code)
	}
}

// TestDeleteVideoHandlerUnauthorized — без user_id в контексте → 401.
func TestDeleteVideoHandlerUnauthorized(t *testing.T) {
	setupVideoTestDB(t)

	author := createVideoTestUser(t, "video_author2", "user")
	video := createTestVideo(t, author.ID)

	w, _ := deleteVideoRequest(t, video.ID, 0)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no auth: status=%d, want 401", w.Code)
	}
	var count int64
	db.Model(&Video{}).Where("id = ?", video.ID).Count(&count)
	if count != 1 {
		t.Fatalf("video must remain, count=%d", count)
	}
}
