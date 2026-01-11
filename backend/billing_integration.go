package main

import (
        "bytes"
        "encoding/base64"
        "encoding/json"
        "fmt"
        "io"
        "log"
        "net/http"
        "os"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

type YooKassaService struct {
        ShopID      string
        SecretKey   string
        APIEndpoint string
}

type YooKassaPaymentRequest struct {
        Amount struct {
                Value    string `json:"value"`
                Currency string `json:"currency"`
        } `json:"amount"`
        Capture           bool                   `json:"capture"`
        Description       string                 `json:"description"`
        Confirmation      map[string]string      `json:"confirmation"`
        Metadata          map[string]interface{} `json:"metadata"`
        SavePaymentMethod bool                   `json:"save_payment_method,omitempty"`
}

type YooKassaPaymentResponse struct {
        ID     string `json:"id"`
        Status string `json:"status"`
        Paid   bool   `json:"paid"`
        Amount struct {
                Value    string `json:"value"`
                Currency string `json:"currency"`
        } `json:"amount"`
        Confirmation struct {
                Type            string `json:"type"`
                ConfirmationURL string `json:"confirmation_url"`
        } `json:"confirmation"`
        CreatedAt     string `json:"created_at"`
        PaymentMethod struct {
                Type  string `json:"type"`
                ID    string `json:"id"`
                Saved bool   `json:"saved"`
        } `json:"payment_method"`
}

type YooKassaRefundRequest struct {
        PaymentID string `json:"payment_id"`
        Amount    struct {
                Value    string `json:"value"`
                Currency string `json:"currency"`
        } `json:"amount"`
        Description string `json:"description,omitempty"`
}

var yookassaService *YooKassaService
var billingTicker *time.Ticker
var billingDone chan bool

func InitBillingSystem() {
        shopID := os.Getenv("YOOKASSA_SHOP_ID")
        secretKey := os.Getenv("YOOKASSA_SECRET_KEY")

        if shopID == "" || secretKey == "" {
                log.Println("[Billing] YooKassa credentials not configured, billing features limited")
                return
        }

        yookassaService = &YooKassaService{
                ShopID:      shopID,
                SecretKey:   secretKey,
                APIEndpoint: "https://api.yookassa.ru/v3",
        }

        billingTicker = time.NewTicker(1 * time.Hour)
        billingDone = make(chan bool)

        go func() {
                for {
                        select {
                        case <-billingDone:
                                return
                        case t := <-billingTicker.C:
                                hour := t.Hour()
                                if hour == 0 {
                                        processAutoRenewals()
                                }
                                if hour%6 == 0 {
                                        retryFailedPayments()
                                }
                                if hour == 8 {
                                        sendExpirationReminders()
                                }
                        }
                }
        }()

        log.Println("[Billing] Scheduler started with auto-renewal, retry, and reminder jobs")
}

func StopBillingSystem() {
        if billingTicker != nil {
                billingTicker.Stop()
        }
        if billingDone != nil {
                billingDone <- true
        }
}

func (yk *YooKassaService) CreatePayment(transactionID uint, amount float64, description string, returnURL string, saveMethod bool) (*YooKassaPaymentResponse, error) {
        paymentReq := YooKassaPaymentRequest{
                Capture:           true,
                Description:       description,
                SavePaymentMethod: saveMethod,
                Confirmation: map[string]string{
                        "type":       "redirect",
                        "return_url": returnURL,
                },
                Metadata: map[string]interface{}{
                        "transaction_id": strconv.FormatUint(uint64(transactionID), 10),
                },
        }
        paymentReq.Amount.Value = fmt.Sprintf("%.2f", amount)
        paymentReq.Amount.Currency = "RUB"

        payloadBytes, err := json.Marshal(paymentReq)
        if err != nil {
                return nil, fmt.Errorf("marshal error: %w", err)
        }

        req, err := http.NewRequest("POST", yk.APIEndpoint+"/payments", bytes.NewBuffer(payloadBytes))
        if err != nil {
                return nil, err
        }

        auth := base64.StdEncoding.EncodeToString([]byte(yk.ShopID + ":" + yk.SecretKey))
        req.Header.Set("Authorization", "Basic "+auth)
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Idempotence-Key", fmt.Sprintf("tx-%d-%d", transactionID, time.Now().Unix()))

        client := &http.Client{Timeout: 30 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("request error: %w", err)
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)

        if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
                return nil, fmt.Errorf("yookassa error %d: %s", resp.StatusCode, string(body))
        }

        var paymentResp YooKassaPaymentResponse
        if err := json.Unmarshal(body, &paymentResp); err != nil {
                return nil, err
        }

        return &paymentResp, nil
}

func (yk *YooKassaService) CreatePaymentWithSavedMethod(transactionID uint, amount float64, description string, paymentMethodID string) (*YooKassaPaymentResponse, error) {
        type AutoPaymentRequest struct {
                Amount struct {
                        Value    string `json:"value"`
                        Currency string `json:"currency"`
                } `json:"amount"`
                Capture         bool                   `json:"capture"`
                Description     string                 `json:"description"`
                PaymentMethodID string                 `json:"payment_method_id"`
                Metadata        map[string]interface{} `json:"metadata"`
        }

        paymentReq := AutoPaymentRequest{
                Capture:         true,
                Description:     description,
                PaymentMethodID: paymentMethodID,
                Metadata: map[string]interface{}{
                        "transaction_id": strconv.FormatUint(uint64(transactionID), 10),
                },
        }
        paymentReq.Amount.Value = fmt.Sprintf("%.2f", amount)
        paymentReq.Amount.Currency = "RUB"

        payloadBytes, err := json.Marshal(paymentReq)
        if err != nil {
                return nil, fmt.Errorf("marshal error: %w", err)
        }

        req, err := http.NewRequest("POST", yk.APIEndpoint+"/payments", bytes.NewBuffer(payloadBytes))
        if err != nil {
                return nil, err
        }

        auth := base64.StdEncoding.EncodeToString([]byte(yk.ShopID + ":" + yk.SecretKey))
        req.Header.Set("Authorization", "Basic "+auth)
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Idempotence-Key", fmt.Sprintf("auto-tx-%d-%d", transactionID, time.Now().Unix()))

        client := &http.Client{Timeout: 30 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("request error: %w", err)
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)

        if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
                return nil, fmt.Errorf("yookassa auto-payment error %d: %s", resp.StatusCode, string(body))
        }

        var paymentResp YooKassaPaymentResponse
        if err := json.Unmarshal(body, &paymentResp); err != nil {
                return nil, err
        }

        log.Printf("[Billing] Auto-payment created: %s for transaction %d", paymentResp.ID, transactionID)
        return &paymentResp, nil
}

func (yk *YooKassaService) CreateRefund(paymentID string, amount float64, description string) error {
        refundReq := YooKassaRefundRequest{
                PaymentID:   paymentID,
                Description: description,
        }
        refundReq.Amount.Value = fmt.Sprintf("%.2f", amount)
        refundReq.Amount.Currency = "RUB"

        payloadBytes, _ := json.Marshal(refundReq)

        req, err := http.NewRequest("POST", yk.APIEndpoint+"/refunds", bytes.NewBuffer(payloadBytes))
        if err != nil {
                return err
        }

        auth := base64.StdEncoding.EncodeToString([]byte(yk.ShopID + ":" + yk.SecretKey))
        req.Header.Set("Authorization", "Basic "+auth)
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Idempotence-Key", fmt.Sprintf("refund-%s-%d", paymentID, time.Now().Unix()))

        client := &http.Client{Timeout: 30 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
                return err
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
                body, _ := io.ReadAll(resp.Body)
                return fmt.Errorf("refund error %d: %s", resp.StatusCode, string(body))
        }

        return nil
}

func processAutoRenewals() {
        log.Println("[Billing] Processing auto-renewals...")

        var subscriptions []PremiumSubscription
        db.Preload("Plan").
                Where("status = ? AND auto_renew = ? AND cancel_at_period_end = ? AND current_period_end <= ?",
                        "active", true, false, time.Now().Add(24*time.Hour)).
                Find(&subscriptions)

        for _, sub := range subscriptions {
                if err := processRenewal(&sub); err != nil {
                        log.Printf("[Billing] Renewal failed for user %d: %v", sub.UserID, err)
                        markRenewalFailed(&sub)
                }
        }

        log.Printf("[Billing] Processed %d auto-renewals", len(subscriptions))
}

func processRenewal(sub *PremiumSubscription) error {
        transaction := PremiumTransaction{
                UserID:          sub.UserID,
                SubscriptionID:  &sub.ID,
                PlanID:          sub.PlanID,
                AmountRub:       sub.Plan.PriceRub,
                Status:          "pending",
                PaymentProvider: "yookassa",
                Description:     fmt.Sprintf("Auto-renewal: %s", sub.Plan.Name),
        }
        db.Create(&transaction)

        if yookassaService == nil {
                return fmt.Errorf("yookassa not configured")
        }

        if sub.PaymentMethodID == "" {
                db.Model(&transaction).Update("status", "failed")
                return fmt.Errorf("no saved payment method for subscription %d", sub.ID)
        }

        payment, err := yookassaService.CreatePaymentWithSavedMethod(
                transaction.ID,
                sub.Plan.PriceRub,
                fmt.Sprintf("Продление подписки %s", sub.Plan.Name),
                sub.PaymentMethodID,
        )
        if err != nil {
                db.Model(&transaction).Update("status", "failed")
                go SendPaymentFailed(sub.UserID, err.Error())
                return err
        }

        if payment.Status == "succeeded" {
                now := time.Now()
                periodEnd := now.AddDate(0, 1, 0)
                if sub.Plan.BillingCycle == "quarterly" {
                        periodEnd = now.AddDate(0, 3, 0)
                } else if sub.Plan.BillingCycle == "annual" {
                        periodEnd = now.AddDate(1, 0, 0)
                }

                db.Model(&transaction).Updates(map[string]interface{}{
                        "status":              "succeeded",
                        "provider_payment_id": payment.ID,
                        "completed_at":        now,
                })

                db.Model(sub).Updates(map[string]interface{}{
                        "current_period_start": now,
                        "current_period_end":   periodEnd,
                })

                go SendPaymentConfirmation(sub.UserID, sub.Plan.Name, sub.Plan.PriceRub)
                log.Printf("[Billing] Auto-renewal succeeded for user %d, subscription %d", sub.UserID, sub.ID)
        } else {
                db.Model(&transaction).Updates(map[string]interface{}{
                        "status":              "pending",
                        "provider_payment_id": payment.ID,
                })
        }

        return nil
}

func markRenewalFailed(sub *PremiumSubscription) {
        var failedCount int64
        db.Model(&PremiumTransaction{}).
                Where("subscription_id = ? AND status = ? AND created_at > ?",
                        sub.ID, "failed", time.Now().Add(-72*time.Hour)).
                Count(&failedCount)

        if failedCount >= 3 {
                db.Model(sub).Updates(map[string]interface{}{
                        "status":     "expired",
                        "auto_renew": false,
                })
                log.Printf("[Billing] Subscription %d expired after 3 failed renewals", sub.ID)
        }
}

func retryFailedPayments() {
        log.Println("[Billing] Retrying failed payments...")

        var transactions []PremiumTransaction
        db.Where("status = ? AND created_at > ?", "failed", time.Now().Add(-72*time.Hour)).
                Find(&transactions)

        for _, tx := range transactions {
                if tx.SubscriptionID == nil {
                        continue
                }

                var sub PremiumSubscription
                if db.Preload("Plan").First(&sub, *tx.SubscriptionID).RowsAffected == 0 || sub.Status != "active" {
                        continue
                }

                if sub.PaymentMethodID == "" {
                        log.Printf("[Billing] No saved payment method for subscription %d, skipping retry", sub.ID)
                        continue
                }

                var retryCount int64
                db.Model(&PremiumTransaction{}).
                        Where("subscription_id = ? AND status IN ? AND created_at > ?",
                                tx.SubscriptionID, []string{"pending", "succeeded"}, time.Now().Add(-24*time.Hour)).
                        Count(&retryCount)

                if retryCount > 0 {
                        continue
                }

                newTx := PremiumTransaction{
                        UserID:          tx.UserID,
                        SubscriptionID:  tx.SubscriptionID,
                        PlanID:          tx.PlanID,
                        AmountRub:       tx.AmountRub,
                        Status:          "pending",
                        PaymentProvider: "yookassa",
                        Description:     "Retry: " + tx.Description,
                }
                db.Create(&newTx)

                if yookassaService != nil {
                        payment, err := yookassaService.CreatePaymentWithSavedMethod(
                                newTx.ID,
                                tx.AmountRub,
                                newTx.Description,
                                sub.PaymentMethodID,
                        )
                        if err != nil {
                                db.Model(&newTx).Update("status", "failed")
                                log.Printf("[Billing] Retry payment failed for tx %d: %v", newTx.ID, err)
                                continue
                        }

                        if payment.Status == "succeeded" {
                                now := time.Now()
                                periodEnd := now.AddDate(0, 1, 0)
                                if sub.Plan.BillingCycle == "quarterly" {
                                        periodEnd = now.AddDate(0, 3, 0)
                                } else if sub.Plan.BillingCycle == "annual" {
                                        periodEnd = now.AddDate(1, 0, 0)
                                }

                                db.Model(&newTx).Updates(map[string]interface{}{
                                        "status":              "succeeded",
                                        "provider_payment_id": payment.ID,
                                        "completed_at":        now,
                                })

                                db.Model(&sub).Updates(map[string]interface{}{
                                        "current_period_start": now,
                                        "current_period_end":   periodEnd,
                                })

                                go SendPaymentConfirmation(sub.UserID, sub.Plan.Name, sub.Plan.PriceRub)
                                log.Printf("[Billing] Retry succeeded for user %d, subscription %d", sub.UserID, sub.ID)
                        } else {
                                db.Model(&newTx).Updates(map[string]interface{}{
                                        "provider_payment_id": payment.ID,
                                })
                        }
                }

                log.Printf("[Billing] Created retry transaction %d for failed tx %d", newTx.ID, tx.ID)
        }
}

func sendExpirationReminders() {
        log.Println("[Billing] Sending expiration reminders...")

        var subscriptions []PremiumSubscription
        expiringIn3Days := time.Now().Add(72 * time.Hour)
        expiringIn1Day := time.Now().Add(24 * time.Hour)

        db.Preload("Plan").
                Where("status = ? AND cancel_at_period_end = ? AND current_period_end BETWEEN ? AND ?",
                        "active", true, expiringIn1Day, expiringIn3Days).
                Find(&subscriptions)

        for _, sub := range subscriptions {
                go SendSubscriptionExpiring(sub.UserID, sub.Plan.Name, sub.CurrentPeriodEnd)
                log.Printf("[Billing] Sent expiration reminder for subscription %d, user %d", sub.ID, sub.UserID)
        }
}

func refundPremiumHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var user User
        if db.First(&user, uid).RowsAffected == 0 || user.Role != "admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
                return
        }

        var req struct {
                TransactionID uint   `json:"transaction_id" binding:"required"`
                Reason        string `json:"reason"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var transaction PremiumTransaction
        if db.First(&transaction, req.TransactionID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
                return
        }

        if transaction.Status != "succeeded" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Can only refund successful transactions"})
                return
        }

        if yookassaService != nil && transaction.ProviderPaymentID != "" {
                if err := yookassaService.CreateRefund(transaction.ProviderPaymentID, transaction.AmountRub, req.Reason); err != nil {
                        log.Printf("[Billing] Refund API error: %v", err)
                }
        }

        now := time.Now()
        db.Model(&transaction).Updates(map[string]interface{}{
                "status":       "refunded",
                "completed_at": now,
        })

        if transaction.SubscriptionID != nil {
                db.Model(&PremiumSubscription{}).Where("id = ?", *transaction.SubscriptionID).
                        Update("status", "cancelled")
        }

        c.JSON(http.StatusOK, gin.H{"status": "refunded"})
}

func getPaymentStatusHandler(c *gin.Context) {
        transactionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
                return
        }

        var transaction PremiumTransaction
        if db.First(&transaction, transactionID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "id":               transaction.ID,
                "status":           transaction.Status,
                "amount_rub":       transaction.AmountRub,
                "confirmation_url": transaction.ConfirmationURL,
                "created_at":       transaction.CreatedAt,
        })
}
