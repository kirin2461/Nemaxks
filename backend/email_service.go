package main

import (
        "fmt"
        "log"
        "net/smtp"
        "os"
        "time"
)

type EmailService struct {
        SMTPHost     string
        SMTPPort     string
        SMTPUser     string
        SMTPPassword string
        FromEmail    string
        FromName     string
        Enabled      bool
}

type EmailTemplate struct {
        Subject string
        Body    string
}

var emailService *EmailService

func InitEmailService() {
        smtpHost := os.Getenv("SMTP_HOST")
        smtpPort := os.Getenv("SMTP_PORT")
        smtpUser := os.Getenv("SMTP_USER")
        smtpPassword := os.Getenv("SMTP_PASSWORD")
        fromEmail := os.Getenv("SMTP_FROM_EMAIL")

        if smtpHost == "" || smtpUser == "" {
                log.Println("[Email] SMTP not configured, email notifications disabled")
                emailService = &EmailService{Enabled: false}
                return
        }

        if smtpPort == "" {
                smtpPort = "587"
        }
        if fromEmail == "" {
                fromEmail = smtpUser
        }

        emailService = &EmailService{
                SMTPHost:     smtpHost,
                SMTPPort:     smtpPort,
                SMTPUser:     smtpUser,
                SMTPPassword: smtpPassword,
                FromEmail:    fromEmail,
                FromName:     "Nemaks",
                Enabled:      true,
        }

        log.Println("[Email] Email service initialized")
}

func (es *EmailService) SendEmail(toEmail, subject, htmlBody string) error {
        if !es.Enabled {
                log.Printf("[Email] Skipped (disabled): %s to %s", subject, toEmail)
                return nil
        }

        auth := smtp.PlainAuth("", es.SMTPUser, es.SMTPPassword, es.SMTPHost)

        mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
        msg := []byte(fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\n%s\r\n%s",
                es.FromName, es.FromEmail, toEmail, subject, mime, htmlBody))

        addr := es.SMTPHost + ":" + es.SMTPPort
        err := smtp.SendMail(addr, auth, es.FromEmail, []string{toEmail}, msg)
        if err != nil {
                log.Printf("[Email] Failed to send: %v", err)
                return err
        }

        log.Printf("[Email] Sent: %s to %s", subject, toEmail)
        return nil
}

func SendPaymentConfirmation(userID uint, planName string, amount float64) {
        var user User
        if db.First(&user, userID).RowsAffected == 0 {
                return
        }

        email := user.Username + "@nemaks.com"
        if user.Email != nil && *user.Email != "" {
                email = *user.Email
        }

        subject := "Подтверждение оплаты Premium"
        body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 10px; padding: 30px;">
<h1 style="color: #a855f7;">Спасибо за подписку!</h1>
<p>Здравствуйте, %s!</p>
<p>Ваша подписка <strong>%s</strong> успешно активирована.</p>
<p>Сумма: <strong>%.0f ₽</strong></p>
<p>Дата: %s</p>
<hr style="border-color: #4a4a6a;">
<p style="color: #888;">Если у вас есть вопросы, свяжитесь с нашей поддержкой.</p>
</div>
</body>
</html>
`, user.Username, planName, amount, time.Now().Format("02.01.2006 15:04"))

        if emailService != nil {
                emailService.SendEmail(email, subject, body)
        }
}

func SendSubscriptionExpiring(userID uint, planName string, expiresAt time.Time) {
        var user User
        if db.First(&user, userID).RowsAffected == 0 {
                return
        }

        email := user.Username + "@nemaks.com"
        if user.Email != nil && *user.Email != "" {
                email = *user.Email
        }

        daysLeft := int(time.Until(expiresAt).Hours() / 24)
        subject := fmt.Sprintf("Подписка истекает через %d дн.", daysLeft)
        body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 10px; padding: 30px;">
<h1 style="color: #f59e0b;">Подписка скоро истекает</h1>
<p>Здравствуйте, %s!</p>
<p>Ваша подписка <strong>%s</strong> истекает %s.</p>
<p>Чтобы продолжить пользоваться всеми преимуществами Premium, продлите подписку.</p>
<a href="https://nemaks.com/premium" style="display: inline-block; background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Продлить подписку</a>
</div>
</body>
</html>
`, user.Username, planName, expiresAt.Format("02.01.2006"))

        if emailService != nil {
                emailService.SendEmail(email, subject, body)
        }
}

func SendSubscriptionCancelled(userID uint, endsAt time.Time) {
        var user User
        if db.First(&user, userID).RowsAffected == 0 {
                return
        }

        email := user.Username + "@nemaks.com"
        if user.Email != nil && *user.Email != "" {
                email = *user.Email
        }

        subject := "Подписка отменена"
        body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 10px; padding: 30px;">
<h1 style="color: #ef4444;">Подписка отменена</h1>
<p>Здравствуйте, %s!</p>
<p>Ваша Premium подписка была отменена.</p>
<p>Вы сохраните доступ до <strong>%s</strong>.</p>
<p>Мы будем рады, если вы вернётесь!</p>
<a href="https://nemaks.com/premium" style="display: inline-block; background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Возобновить подписку</a>
</div>
</body>
</html>
`, user.Username, endsAt.Format("02.01.2006"))

        if emailService != nil {
                emailService.SendEmail(email, subject, body)
        }
}

func SendPaymentFailed(userID uint, reason string) {
        var user User
        if db.First(&user, userID).RowsAffected == 0 {
                return
        }

        email := user.Username + "@nemaks.com"
        if user.Email != nil && *user.Email != "" {
                email = *user.Email
        }

        subject := "Ошибка оплаты"
        body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 10px; padding: 30px;">
<h1 style="color: #ef4444;">Ошибка оплаты</h1>
<p>Здравствуйте, %s!</p>
<p>Не удалось провести платёж за Premium подписку.</p>
<p>Пожалуйста, проверьте платёжные данные и попробуйте снова.</p>
<a href="https://nemaks.com/premium" style="display: inline-block; background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Повторить оплату</a>
</div>
</body>
</html>
`, user.Username)

        if emailService != nil {
                emailService.SendEmail(email, subject, body)
        }
}
