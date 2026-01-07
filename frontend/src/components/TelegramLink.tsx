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
      alert('Failed to create link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    console.log('Unlinking Telegram...');
    if (!confirm('Are you sure you want to unlink your Telegram account?')) {
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
      alert('Failed to unlink. Please try again.');
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
          <MessageCircle className="w-5 h-5 text-blue-500" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linkStatus?.linked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-500">
              <Check className="w-5 h-5" />
              <span>Connected to @{linkStatus.telegram_username}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <span className="text-sm">Receive notifications in Telegram</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleNotifications}
                disabled={loading}
              >
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5 text-green-500" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
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
              Unlink Telegram
            </Button>
          </div>
        ) : linkCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send this code to @{botUsername} on Telegram:
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 p-4 text-center font-mono text-2xl font-bold bg-white/5 rounded-lg border border-white/10">
                {linkCode}
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode}>
                {codeCopied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Code expires in {Math.floor(expiresIn / 60)}:{(expiresIn % 60).toString().padStart(2, '0')}
            </p>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="secondary" className="w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Open @{botUsername}
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
              Check status
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Link your Telegram account to receive notifications.
            </p>
            <Button
              onClick={handleCreateLink}
              disabled={loading}
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Link Telegram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TelegramLink;
