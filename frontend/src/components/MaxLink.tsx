import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { maxAPI } from '@/lib/api';
import { MessageSquare, Check, X, Copy, RefreshCw } from 'lucide-react';

interface MaxLinkProps {
  isOwnProfile: boolean;
}

export function MaxLink({ isOwnProfile }: MaxLinkProps) {
  const [loading, setLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{
    linked: boolean;
    max_username?: string;
    max_user_id?: number;
  } | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botName, setBotName] = useState<string>('Nemaks');
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
      const status = await maxAPI.getLink();
      setLinkStatus(status);
    } catch (error) {
      console.error('Failed to fetch MAX link status:', error);
    }
  };

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const result = await maxAPI.createLink();
      setLinkCode(result.code);
      setBotName(result.bot_name);
      setExpiresIn(result.expires_in);
    } catch (error) {
      console.error('Failed to create MAX link:', error);
      alert('Не удалось создать ссылку. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Вы уверены, что хотите отвязать аккаунт MAX?')) {
      return;
    }
    setLoading(true);
    try {
      await maxAPI.unlinkMax();
      setLinkStatus({ linked: false });
    } catch (error) {
      console.error('Failed to unlink MAX:', error);
      alert('Не удалось отвязать аккаунт. Попробуйте ещё раз.');
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
          <MessageSquare className="w-5 h-5 text-accent" />
          MAX
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linkStatus?.linked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Check className="w-5 h-5" />
              <span>
                Подключено: {linkStatus.max_username || `ID ${linkStatus.max_user_id}`}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Сообщения из MAX доставляются в ваш канал-мост в Nebula, ответы из него возвращаются в MAX.
            </p>

            <Button
              variant="danger"
              size="sm"
              onClick={handleUnlink}
              disabled={loading}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Отвязать MAX
            </Button>
          </div>
        ) : linkCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Отправьте этот код боту {botName} в MAX (командой /link {linkCode} или просто кодом):
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
              Привяжите аккаунт MAX, чтобы получать сообщения и отвечать на них прямо из Nebula.
            </p>
            <Button
              onClick={handleCreateLink}
              disabled={loading}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Привязать MAX
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MaxLink;
