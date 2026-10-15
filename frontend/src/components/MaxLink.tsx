import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Hint } from '@/components/ui/hint';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { maxAPI, MaxLinkStatus } from '@/lib/api';
import {
  MessageSquare,
  Check,
  X,
  Copy,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface MaxLinkProps {
  isOwnProfile: boolean;
}

export function MaxLink({ isOwnProfile }: MaxLinkProps) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<MaxLinkStatus | null>(null);
  // webhook_set известен только из ответа connect — после перезагрузки
  // страницы статус автонастройки неизвестен (null)
  const [webhookSet, setWebhookSet] = useState<boolean | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOwnProfile) {
      fetchLinkStatus();
    }
  }, [isOwnProfile]);

  const fetchLinkStatus = async () => {
    try {
      const data = await maxAPI.getLink();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch MAX link status:', err);
      setStatus({ connected: false });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!token.trim()) {
      setError('Вставьте токен бота — без него подключиться не получится.');
      return;
    }
    setConnecting(true);
    setError(null);
    setWarning(null);
    try {
      const result = await maxAPI.connect(token.trim());
      setWebhookSet(result.webhook_set);
      setWarning(result.warning ?? null);
      setToken('');
      await fetchLinkStatus();
    } catch (err) {
      console.error('Failed to connect MAX bot:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось подключить бота. Попробуйте ещё раз.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setDisconnecting(true);
    setError(null);
    try {
      await maxAPI.disconnect();
      setStatus({ connected: false });
      setWebhookSet(null);
      setWarning(null);
      toast.success('Бот MAX отключён');
    } catch (err) {
      console.error('Failed to disconnect MAX bot:', err);
      setError('Не удалось отключить бота. Попробуйте ещё раз.');
    } finally {
      setDisconnecting(false);
    }
  };

  const copyValue = (value: string, field: 'url' | 'secret') => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOwnProfile) return null;

  const connected = !!status?.connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-700" />
          Мессенджер MAX
        </CardTitle>
      </CardHeader>
      <CardContent>
        {initialLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <Check className="w-5 h-5" />
              <span>
                Подключён бот:{' '}
                {status?.bot_name || status?.bot_username || 'MAX-бот'}
                {status?.bot_username && status?.bot_name && (
                  <span className="text-muted-foreground">
                    {' '}
                    (@{status.bot_username})
                  </span>
                )}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Сообщения из MAX доставляются в ваш канал-мост в Nebula, а ответы
              из него возвращаются в MAX.
            </p>

            {webhookSet === true && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Check className="w-4 h-4" />
                Webhook настроен автоматически
              </div>
            )}

            {webhookSet === false && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="w-4 h-4" />
                Требуется ручная настройка webhook
              </div>
            )}

            {warning && (
              <div className="p-3 rounded-lg bg-warning-soft border border-warning/30 text-sm text-warning">
                {warning}
              </div>
            )}

            {(status?.webhook_url || status?.webhook_secret) && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Настройки webhook
                  <Hint text="Если webhook не удалось установить автоматически, откройте кабинет разработчика MAX (dev.max.ru), выберите своего бота и в разделе подписок (subscriptions) укажите этот URL. Секрет передавайте в заголовке X-Max-Bot-Api-Secret или параметром ?secret= — так Nebula поймёт, что сообщение пришло именно от вашего бота." />
                </div>

                {status?.webhook_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      URL для webhook
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate p-2 rounded bg-background border border-border text-xs font-mono">
                        {status.webhook_url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyValue(status.webhook_url!, 'url')}
                        aria-label="Скопировать URL webhook"
                      >
                        {copiedField === 'url' ? (
                          <Check className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {status?.webhook_secret && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Секрет webhook
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate p-2 rounded bg-background border border-border text-xs font-mono">
                        {status.webhook_secret}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyValue(status.webhook_secret!, 'secret')
                        }
                        aria-label="Скопировать секрет webhook"
                      >
                        {copiedField === 'secret' ? (
                          <Check className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {status?.bridge_channel_id && (
              <Link href="/channels">
                <Button variant="secondary" size="sm" className="w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Открыть канал-мост
                </Button>
              </Link>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-danger-soft border border-destructive/30 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDisconnectConfirm(true)}
              loading={disconnecting}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Отключить
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Подключите своего бота MAX, чтобы получать сообщения из MAX прямо
              в Nebula и отвечать на них, не выходя из Nebula.
            </p>

            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">
                  1
                </span>
                <span className="flex-1">
                  Создайте бота в MAX{' '}
                  <Hint text="Зайдите на dev.max.ru (платформа партнёров MAX), войдите и нажмите «Создать бота». После заполнения анкеты вы получите токен доступа. Важно: для создания бота потребуется верифицированный профиль организации, ИП или самозанятого (РФ)." />
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">
                  2
                </span>
                <span className="flex-1">
                  Скопируйте токен бота{' '}
                  <Hint text="Токен — длинная строка из букв и цифр, которую MAX показывает после создания бота. Храните его в секрете: любой, кто знает токен, может управлять вашим ботом." />
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">
                  3
                </span>
                <span className="flex-1">
                  Вставьте токен ниже и нажмите «Подключить»{' '}
                  <Hint text="Мы проверим токен через API MAX и автоматически настроим webhook — сообщения начнут приходить в канал-мост. Токен хранится только на сервере и никогда не показывается в интерфейсе." />
                </span>
              </li>
            </ol>

            <Input
              type="password"
              placeholder="Токен бота MAX"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnect();
              }}
              disabled={connecting}
              autoComplete="off"
            />

            {error && (
              <div className="p-3 rounded-lg bg-danger-soft border border-destructive/30 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={handleConnect}
              loading={connecting}
              disabled={!token.trim()}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Подключить
            </Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Отключение бота MAX"
        message="Отключить бота MAX? Сообщения из MAX перестанут приходить в Nebula. История канала-моста сохранится."
        confirmText="Отключить"
        variant="danger"
        loading={disconnecting}
      />
    </Card>
  );
}

export default MaxLink;
