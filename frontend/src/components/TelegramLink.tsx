import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { telegramAPI } from '@/lib/api';
import { MessageCircle, Check, X, Copy, RefreshCw, Bell, BellOff } from 'lucide-react';

interface TelegramLinkProps {
  isOwnProfile: boolean;
}

export function TelegramLink({ isOwnProfile }: TelegramLinkProps) {
  const [loading, setLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{
    linked: boolean;
    telegram_username?: string;
    telegram_id?: number;
  } | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('NemaksBot');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);

  useEffect(() => {
    if (isOwnProfile) {
      fetchLinkStatus();
    }
  }, [isOwnProfile]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (expiresIn > 0) {
      timer = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            setLinkCode(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [expiresIn]);

  const fetchLinkStatus = async () => {
    try {
      const status = await telegramAPI.getLink();
      setLinkStatus(status);
      setNotificationsEnabled(status.linked);
    } catch (error) {
      console.error('Failed to fetch Telegram link status:', error);
    }
  };

  const handleCreateLink = async () => {
    console.log('Creating Telegram link...');
    setLoading(true);
    try {
      const result = await telegramAPI.createLink();
      console.log('Link created:', result);
      setLinkCode(result.code);
      setBotUsername(result.bot_username);
      setExpiresIn(result.expires_in);
    } catch (error) {
      console.error('Failed to create Telegram link:', error);
      alert('Не удалось создать ссылку. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    console.log('Unlinking Telegram...');
    if (!confirm('Вы уверены, что хотите отвязать Telegram-аккаунт?')) {
      return;
    }
    setLoading(true);
    try {
      await telegramAPI.unlinkTelegram();
      console.log('Telegram unlinked successfully');
      setLinkStatus({ linked: false });
      setNotificationsEnabled(false);
    } catch (error) {
      console.error('Failed to unlink Telegram:', error);
      alert('Не удалось отвязать аккаунт. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    console.log('Toggling notifications:', !notificationsEnabled);
    setLoading(true);
    try {
      await telegramAPI.updateSettings(!notificationsEnabled);
      setNotificationsEnabled(!notificationsEnabled);
      console.log('Notifications updated');
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  if (!isOwnProfile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-accent" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linkStatus?.linked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Check className="w-5 h-5" />
              <span>Подключено: @{linkStatus.telegram_username}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
              <span className="text-sm">Получать уведомления в Telegram</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleNotifications}
                disabled={loading}
              >
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5 text-accent" />
                ) : (
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={handleUnlink}
              disabled={loading}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Отвязать Telegram
            </Button>
          </div>
        ) : linkCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Отправьте этот код боту @{botUsername} в Telegram:
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 p-4 text-center font-mono text-2xl font-bold bg-muted/40 rounded-lg border border-border">
                {linkCode}
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode}>
                {codeCopied ? (
                  <Check className="w-5 h-5 text-accent" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Код истекает через {Math.floor(expiresIn / 60)}:{(expiresIn % 60).toString().padStart(2, '0')}
            </p>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="secondary" className="w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Открыть @{botUsername}
              </Button>
            </a>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinkCode(null);
                fetchLinkStatus();
              }}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Проверить статус
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Привяжите Telegram-аккаунт, чтобы получать уведомления.
            </p>
            <Button
              onClick={handleCreateLink}
              disabled={loading}
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Привязать Telegram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TelegramLink;
