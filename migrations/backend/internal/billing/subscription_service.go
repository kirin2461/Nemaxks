package billing

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"gorm.io/gorm"
)

// SubscriptionService handles subscription and billing logic
type SubscriptionService struct {
	db *gorm.DB
}

// NewSubscriptionService creates a new subscription service
func NewSubscriptionService(db *gorm.DB) *SubscriptionService {
	return &SubscriptionService{db: db}
}

// SubscriptionPlan represents a subscription plan
type SubscriptionPlan struct {
	ID                    int        `gorm:"primaryKey"`
	Slug                  string     `gorm:"uniqueIndex"`
	Name                  string
	BasePriceRub          float64
	VideoRetentionDays    int
	MessagesRetentionDays int
	BoardsPersistFlag     bool
	JarvisDailyLimit      int
	OverageStorageEnabled bool
	IsActive              bool
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// OrgSubscription represents an organization's subscription
type OrgSubscription struct {
	ID                 int       `gorm:"primaryKey"`
	OrgID              int
	PlanID             int
	SeatsStudentEditor int
	SeatsStaff         int
	StartsAt           time.Time
	EndsAt             time.Time
	GraceUntil         *time.Time
	AutoRenew          bool
	PaymentProvider    string
	BillingPeriod      string
	Status             string // active, expired, cancelled
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// GetOrgSubscription retrieves the current subscription for an organization
func (s *SubscriptionService) GetOrgSubscription(ctx context.Context, orgID int) (*OrgSubscription, error) {
	var subscription OrgSubscription

	result := s.db.WithContext(ctx).
		Where("org_id = ? AND status = 'active' AND ends_at > ?", orgID, time.Now()).
		First(&subscription)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, sql.ErrNoRows
	}

	if result.Error != nil {
		return nil, result.Error
	}

	return &subscription, nil
}

// CalculateMonthlyCharge calculates the total monthly charge for an organization
func (s *SubscriptionService) CalculateMonthlyCharge(ctx context.Context, orgID int, planID int) (float64, error) {
	var plan SubscriptionPlan

	// Get the plan
	if err := s.db.WithContext(ctx).First(&plan, planID).Error; err != nil {
		return 0, err
	}

	total := plan.BasePriceRub

	// Get seat counts - simplified for demo
	// In production, count actual billable seats from org_member table

	// Add seat costs for Edu Basic and Edu Pro
	if planID == 2 || planID == 3 { // Edu Basic or Edu Pro
		// Default: 10 student editors and 2 staff for demo
		total += 10 * 35.0  // student_editor: 35 rub/month
		total += 2 * 500.0  // staff: 500 rub/month
	}

	return total, nil
}

// HasPlanFeature checks if an organization has access to a specific plan feature
func (s *SubscriptionService) HasPlanFeature(ctx context.Context, orgID int, featureKey string) (bool, error) {
	sub, err := s.GetOrgSubscription(ctx, orgID)
	if err != nil {
		return false, nil // No active subscription = no features
	}

	var plan SubscriptionPlan
	if err := s.db.WithContext(ctx).First(&plan, sub.PlanID).Error; err != nil {
		return false, err
	}

	// Check specific features based on plan
	switch featureKey {
	case "boards_persist":
		return plan.BoardsPersistFlag, nil
	case "overage_storage":
		return plan.OverageStorageEnabled, nil
	case "traffic_reports":
		return plan.ID == 3 // Only Edu Pro (ID=3)
	default:
		return false, nil
	}
}

// CanAccessSpecialChannel checks if a user can access special organization channels
func (s *SubscriptionService) CanAccessSpecialChannel(ctx context.Context, orgID int) (bool, error) {
	sub, err := s.GetOrgSubscription(ctx, orgID)
	if err != nil {
		return false, nil // No subscription = no access
	}

	return sub.Status == "active" && sub.EndsAt.After(time.Now()), nil
}
