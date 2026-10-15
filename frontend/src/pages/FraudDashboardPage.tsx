import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Ban, Eye, Search, Filter,
  CheckCircle, XCircle, Clock, Users, Globe, Fingerprint,
  TrendingUp, AlertOctagon, MessageSquare
} from 'lucide-react';
import { fraudAPI, FraudAlert, FraudStats, FraudRule, UserRiskScore, ImpersonationBan } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'overview' | 'alerts' | 'rules' | 'risk' | 'bans' | 'analyze';

export default function FraudDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [alertFilter, setAlertFilter] = useState({ status: '', type: '', severity: '' });
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [analyzeContent, setAnalyzeContent] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['fraud-stats'],
    queryFn: () => fraudAPI.getStats(),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['fraud-alerts', alertFilter],
    queryFn: () => fraudAPI.getAlerts(1, 20, alertFilter.status, alertFilter.type, alertFilter.severity),
    enabled: activeTab === 'alerts' || activeTab === 'overview',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['fraud-rules'],
    queryFn: () => fraudAPI.getRules(),
    enabled: activeTab === 'rules',
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['risk-scores'],
    queryFn: () => fraudAPI.getRiskScores(50),
    enabled: activeTab === 'risk',
  });

  const { data: bansData } = useQuery({
    queryKey: ['impersonation-bans'],
    queryFn: () => fraudAPI.getImpersonationBans(),
    enabled: activeTab === 'bans',
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, action, notes }: { id: number; status: string; action: string; notes: string }) =>
      fraudAPI.reviewAlert(id, status, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['fraud-stats'] });
      setSelectedAlert(null);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (content: string) => fraudAPI.analyzeContent(content),
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-danger-soft text-destructive';
      case 'high': return 'bg-danger-soft text-destructive';
      case 'medium': return 'bg-warning-soft text-[hsl(32_95%_30%)]';
      case 'low': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-warning" />;
      case 'reviewed': return <Eye className="w-4 h-4 text-graphite-500" />;
      case 'actioned': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'dismissed': return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: Shield },
    { id: 'alerts', label: 'Алерты', icon: AlertTriangle },
    { id: 'rules', label: 'Правила', icon: Filter },
    { id: 'risk', label: 'Риск-скоры', icon: TrendingUp },
    { id: 'bans', label: 'Баны', icon: Ban },
    { id: 'analyze', label: 'Анализ', icon: Search },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-6">
      <div className="max-w-[1440px] mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-7 h-7 text-emerald-700" />
          <h1 className="text-2xl font-display font-bold text-graphite-900">Антифрод-панель</h1>
        </div>

        <div className="flex gap-4 mb-6 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-2.5 -mb-px whitespace-nowrap text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={AlertTriangle}
                label="Всего алертов"
                value={stats.total_alerts}
                color="text-destructive"
              />
              <StatCard
                icon={Clock}
                label="Ожидают проверки"
                value={stats.pending_alerts}
                color="text-warning"
              />
              <StatCard
                icon={Ban}
                label="Импер. баны"
                value={stats.impersonation_bans}
                color="text-destructive"
              />
              <StatCard
                icon={Users}
                label="Высокий риск"
                value={stats.high_risk_users}
                color="text-warning"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-700" />
                  Заблокированные IP
                </h3>
                <p className="text-3xl font-display font-bold text-graphite-900">{stats.blocked_ips}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-emerald-700" />
                  Забаненные устройства
                </h3>
                <p className="text-3xl font-display font-bold text-graphite-900">{stats.banned_devices}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <h3 className="text-lg font-semibold mb-4">Последние алерты</h3>
              <div className="space-y-3">
                {alertsData?.alerts?.slice(0, 5).map((alert: FraudAlert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between px-4 py-3 bg-graphite-100 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(alert.status)}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm">{alert.alert_type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <select
                value={alertFilter.status}
                onChange={e => setAlertFilter(f => ({ ...f, status: e.target.value }))}
                className="input-field !w-auto px-3 py-2"
              >
                <option value="">Все статусы</option>
                <option value="pending">Ожидают</option>
                <option value="reviewed">Проверены</option>
                <option value="actioned">Обработаны</option>
                <option value="dismissed">Отклонены</option>
              </select>
              <select
                value={alertFilter.type}
                onChange={e => setAlertFilter(f => ({ ...f, type: e.target.value }))}
                className="input-field !w-auto px-3 py-2"
              >
                <option value="">Все типы</option>
                <option value="impersonation">Имперсонация</option>
                <option value="phishing">Фишинг</option>
                <option value="scam">Скам</option>
                <option value="spam">Спам</option>
              </select>
              <select
                value={alertFilter.severity}
                onChange={e => setAlertFilter(f => ({ ...f, severity: e.target.value }))}
                className="input-field !w-auto px-3 py-2"
              >
                <option value="">Все уровни</option>
                <option value="critical">Критический</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>

            <div className="space-y-3">
              {alertsData?.alerts?.map((alert: FraudAlert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-graphite-300 transition-colors duration-150 shadow-none"
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(alert.status)}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="font-medium capitalize">{alert.alert_type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-foreground text-sm mb-2">{alert.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>User: {alert.user?.username || alert.user_id}</span>
                    <span>IP: {alert.source_ip}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-4">
            {rules.map((rule: FraudRule) => (
              <div key={rule.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{rule.name}</h3>
                    <p className="text-muted-foreground text-sm">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                      {rule.severity}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted-foreground'}`}>
                      {rule.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                  <span>Тип: {rule.rule_type}</span>
                  <span>Действие: {rule.action}</span>
                  <span>Приоритет: {rule.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="space-y-4">
            {riskScores.map((score: UserRiskScore) => (
              <div key={score.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-semibold flex items-center justify-center ring-1 ring-border">
                      {score.user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold">{score.user?.username || `User #${score.user_id}`}</p>
                      <p className="text-xs text-muted-foreground">{score.total_alerts} алертов</p>
                    </div>
                  </div>
                  <div className={`text-3xl font-display font-bold transition-colors duration-300 ${
                    score.score >= 70 ? 'text-destructive' :
                    score.score >= 40 ? 'text-warning' : 'text-emerald-700'
                  }`}>
                    {Math.round(score.score)}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <ScoreBar label="Спам" value={score.spam_score} />
                  <ScoreBar label="Фишинг" value={score.phishing_score} />
                  <ScoreBar label="Импер." value={score.impersonation_score} />
                  <ScoreBar label="Скам" value={score.scam_score} />
                  <ScoreBar label="Поведение" value={score.behavior_score} />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bans' && (
          <div className="space-y-4">
            {bansData?.bans?.map((ban: ImpersonationBan) => (
              <div key={ban.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="w-6 h-6 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive">{ban.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ban.banned_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-danger-soft text-destructive">PERMABAN</span>
                </div>
                <div className="bg-graphite-100 border border-border rounded-lg p-3 mb-3">
                  <p className="text-sm text-foreground break-all">{ban.original_message}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(ban.detected_keywords || '[]').map((kw: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-danger-soft text-destructive">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analyze' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-700" />
                Анализ контента
              </h3>
              <textarea
                value={analyzeContent}
                onChange={e => setAnalyzeContent(e.target.value)}
                placeholder="Введите текст для анализа на мошенничество..."
                className="input-field resize-none h-32 p-4"
              />
              <button
                onClick={() => analyzeMutation.mutate(analyzeContent)}
                disabled={!analyzeContent || analyzeMutation.isPending}
                className="mt-4 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
              >
                Анализировать
              </button>
            </div>

            {analyzeMutation.data && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4">Результаты анализа</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-graphite-100 border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Нормализованный текст:</p>
                    <p className="text-sm">{analyzeMutation.data.normalized}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    analyzeMutation.data.is_fraud ? 'bg-danger-soft border-destructive/30' : 'bg-success-soft border-emerald-200'
                  }`}>
                    <p className={`font-semibold ${
                      analyzeMutation.data.is_fraud ? 'text-destructive' : 'text-emerald-800'
                    }`}>
                      {analyzeMutation.data.is_fraud ? 'ОБНАРУЖЕНО МОШЕННИЧЕСТВО' : 'Чисто'}
                    </p>
                  </div>
                  {analyzeMutation.data.results?.map((result: any, i: number) => (
                    <div key={i} className="p-4 bg-graphite-100 border border-border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(result.severity)}`}>
                          {result.severity}
                        </span>
                        <span className="font-medium capitalize">{result.alert_type}</span>
                      </div>
                      <p className="text-sm text-foreground">{result.description}</p>
                      {result.matched_keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.matched_keywords.map((kw: string, j: number) => (
                            <span key={j} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-danger-soft text-destructive">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedAlert && (
          <AlertReviewModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onReview={(status, action, notes) => 
              reviewMutation.mutate({ id: selectedAlert.id, status, action, notes })
            }
            isLoading={reviewMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft animate-count-flick">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1">{label}</p>
      <div className="w-full bg-graphite-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full origin-left animate-bar-grow ${
            value >= 70 ? 'bg-destructive' : value >= 40 ? 'bg-warning' : 'bg-emerald-600'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-center mt-1 font-mono">{Math.round(value)}</p>
    </div>
  );
}

function AlertReviewModal({
  alert,
  onClose,
  onReview,
  isLoading
}: {
  alert: FraudAlert;
  onClose: () => void;
  onReview: (status: string, action: string, notes: string) => void;
  isLoading: boolean;
}) {
  const [status, setStatus] = useState('reviewed');
  const [action, setAction] = useState('none');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in-soft">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-border bg-card p-6 shadow-pop w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <h3 className="text-xl font-bold mb-4">Проверка алерта #{alert.id}</h3>
        
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-graphite-100 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Описание</p>
            <p className="text-sm">{alert.description}</p>
          </div>

          {alert.evidence && (
            <div className="p-4 bg-graphite-950 rounded-lg">
              <p className="text-xs text-graphite-400 mb-1">Доказательства</p>
              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto">{alert.evidence}</pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Статус</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="input-field"
            >
              <option value="reviewed">Проверен</option>
              <option value="actioned">Обработан</option>
              <option value="dismissed">Отклонен</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Действие</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="input-field"
            >
              <option value="none">Без действия</option>
              <option value="warn">Предупреждение</option>
              <option value="mute">Мут</option>
              <option value="ban">Бан</option>
              <option value="permaban">Перманентный бан</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Заметки</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field resize-none h-20"
              placeholder="Опциональные заметки..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all duration-150"
          >
            Отмена
          </button>
          <button
            onClick={() => onReview(status, action, notes)}
            disabled={isLoading}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </div>
  );
}
