package billing

import (
	"backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PricingHandler handles all pricing-related API endpoints
type PricingHandler struct {
	db *gorm.DB
}

// NewPricingHandler creates a new pricing handler
func NewPricingHandler(db *gorm.DB) *PricingHandler {
	return &PricingHandler{db: db}
}

// ListSubscriptionPlans returns all active subscription plans
// GET /api/admin/pricing/plans
func (h *PricingHandler) ListSubscriptionPlans(c *gin.Context) {
	var plans []models.SubscriptionPlan
	if err := h.db.Where("status = ?", "active").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch plans"})
		return
	}
	c.JSON(http.StatusOK, plans)
}

// GetSubscriptionPlan returns a specific subscription plan by ID
// GET /api/admin/pricing/plans/:id
func (h *PricingHandler) GetSubscriptionPlan(c *gin.Context) {
	id := c.Param("id")
	var plan models.SubscriptionPlan
	if err := h.db.First(&plan, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

// CreateSubscriptionPlan creates a new subscription plan
// POST /api/admin/pricing/plans
func (h *PricingHandler) CreateSubscriptionPlan(c *gin.Context) {
	var req struct {
		Name          string  `json:"name" binding:"required"`
		Description   string  `json:"description"`
		Price         float64 `json:"price" binding:"required"`
		BillingCycle  string  `json:"billing_cycle" binding:"required"`
		Features      string  `json:"features"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan := models.SubscriptionPlan{
		Name:         req.Name,
		Description:  req.Description,
		Price:        req.Price,
		BillingCycle: req.BillingCycle,
		Features:     req.Features,
		Status:       "active",
	}

	if err := h.db.Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create plan"})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

// UpdateSubscriptionPlan updates an existing subscription plan
// PUT /api/admin/pricing/plans/:id
func (h *PricingHandler) UpdateSubscriptionPlan(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name         string  `json:"name"`
		Description  string  `json:"description"`
		Price        float64 `json:"price"`
		BillingCycle string  `json:"billing_cycle"`
		Features     string  `json:"features"`
		Status       string  `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var plan models.SubscriptionPlan
	if err := h.db.Model(&plan).Where("id = ?", id).Updates(req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update plan"})
		return
	}

	h.db.First(&plan, id)
	c.JSON(http.StatusOK, plan)
}

// DeleteSubscriptionPlan soft deletes a subscription plan
// DELETE /api/admin/pricing/plans/:id
func (h *PricingHandler) DeleteSubscriptionPlan(c *gin.Context) {
	id := c.Param("id")
	var plan models.SubscriptionPlan
	if err := h.db.Model(&plan).Where("id = ?", id).Update("status", "inactive").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete plan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Plan deleted successfully"})
}

// GetPlanMetrics returns pricing metrics and statistics
// GET /api/admin/pricing/metrics
func (h *PricingHandler) GetPlanMetrics(c *gin.Context) {
	var metrics struct {
		TotalPlans       int64
		ActivePlans      int64
		AveragePrice     float64
		TotalSubscribers int64
	}

	h.db.Model(&models.SubscriptionPlan{}).Count(&metrics.TotalPlans)
	h.db.Model(&models.SubscriptionPlan{}).Where("status = ?", "active").Count(&metrics.ActivePlans)
	h.db.Model(&models.Subscription{}).Count(&metrics.TotalSubscribers)

	// Calculate average price
	h.db.Model(&models.SubscriptionPlan{}).Select("COALESCE(AVG(price), 0)").Row().Scan(&metrics.AveragePrice)

	c.JSON(http.StatusOK, metrics)
}

// RegisterPricingRoutes registers all pricing-related routes
func RegisterPricingRoutes(router *gin.Engine, db *gorm.DB) {
	handler := NewPricingHandler(db)

	router.GET("/api/admin/pricing/plans", handler.ListSubscriptionPlans)
	router.GET("/api/admin/pricing/plans/:id", handler.GetSubscriptionPlan)
	router.POST("/api/admin/pricing/plans", handler.CreateSubscriptionPlan)
	router.PUT("/api/admin/pricing/plans/:id", handler.UpdateSubscriptionPlan)
	router.DELETE("/api/admin/pricing/plans/:id", handler.DeleteSubscriptionPlan)
	router.GET("/api/admin/pricing/metrics", handler.GetPlanMetrics)
}
