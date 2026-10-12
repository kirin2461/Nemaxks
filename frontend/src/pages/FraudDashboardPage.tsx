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
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'reviewed': return <Eye className="w-4 h-4 text-blue-400" />;
      case 'actioned': return <CheckCircle className="w-4 h-4 text-green-400" />;
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
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Anti-Fraud Dashboard</h1>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
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
                color="text-red-400"
              />
              <StatCard
                icon={Clock}
                label="Ожидают проверки"
                value={stats.pending_alerts}
                color="text-yellow-400"
              />
              <StatCard
                icon={Ban}
                label="Импер. баны"
                value={stats.impersonation_bans}
                color="text-purple-400"
              />
              <StatCard
                icon={Users}
                label="Высокий риск"
                value={stats.high_risk_users}
                color="text-orange-400"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Заблокированные IP
                </h3>
                <p className="text-4xl font-bold text-blue-400">{stats.blocked_ips}</p>
              </div>
              <div className="bg-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-green-400" />
                  Забаненные устройства
                </h3>
                <p className="text-4xl font-bold text-green-400">{stats.banned_devices}</p>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4">Последние алерты</h3>
              <div className="space-y-3">
                {alertsData?.alerts?.slice(0, 5).map((alert: FraudAlert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(alert.status)}
                      <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
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
                className="px-3 py-2 bg-card rounded-lg"
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
                className="px-3 py-2 bg-card rounded-lg"
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
                className="px-3 py-2 bg-card rounded-lg"
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
                  className="bg-card rounded-xl p-5 cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(alert.status)}
                      <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
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
              <div key={rule.id} className="bg-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold">{rule.name}</h3>
                    <p className="text-muted-foreground text-sm">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(rule.severity)}`}>
                      {rule.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${rule.is_active ? 'bg-green-600' : 'bg-muted'}`}>
                      {rule.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              <div key={score.id} className="bg-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      {score.user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-bold">{score.user?.username || `User #${score.user_id}`}</p>
                      <p className="text-xs text-muted-foreground">{score.total_alerts} алертов</p>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    score.score >= 70 ? 'text-red-400' :
                    score.score >= 40 ? 'text-yellow-400' : 'text-green-400'
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
              <div key={ban.id} className="bg-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="w-6 h-6 text-red-400" />
                    <div>
                      <p className="font-bold text-red-400">{ban.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ban.banned_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-red-600 px-2 py-1 rounded">PERMABAN</span>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-foreground break-all">{ban.original_message}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(ban.detected_keywords || '[]').map((kw: string, i: number) => (
                    <span key={i} className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
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
            <div className="bg-card rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                Анализ контента
              </h3>
              <textarea
                value={analyzeContent}
                onChange={e => setAnalyzeContent(e.target.value)}
                placeholder="Введите текст для анализа на мошенничество..."
                className="w-full p-4 bg-secondary rounded-lg resize-none h-32 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => analyzeMutation.mutate(analyzeContent)}
                disabled={!analyzeContent || analyzeMutation.isPending}
                className="mt-4 px-6 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Анализировать
              </button>
            </div>

            {analyzeMutation.data && (
              <div className="bg-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Результаты анализа</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Нормализованный текст:</p>
                    <p className="text-sm">{analyzeMutation.data.normalized}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    analyzeMutation.data.is_fraud ? 'bg-red-600/20' : 'bg-green-600/20'
                  }`}>
                    <p className={`font-bold ${
                      analyzeMutation.data.is_fraud ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {analyzeMutation.data.is_fraud ? 'ОБНАРУЖЕНО МОШЕННИЧЕСТВО' : 'Чисто'}
                    </p>
                  </div>
                  {analyzeMutation.data.results?.map((result: any, i: number) => (
                    <div key={i} className="p-4 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(result.severity)}`}>
                          {result.severity}
                        </span>
                        <span className="font-medium capitalize">{result.alert_type}</span>
                      </div>
                      <p className="text-sm text-foreground">{result.description}</p>
                      {result.matched_keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.matched_keywords.map((kw: string, j: number) => (
                            <span key={j} className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">
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
    <div className="bg-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1">{label}</p>
      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className={`h-2 rounded-full ${
            value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-center mt-1">{Math.round(value)}</p>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold mb-4">Проверка алерта #{alert.id}</h3>
        
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Описание</p>
            <p className="text-sm">{alert.description}</p>
          </div>
          
          {alert.evidence && (
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Доказательства</p>
              <pre className="text-xs overflow-x-auto">{alert.evidence}</pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Статус</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-4 py-2 bg-secondary rounded-lg"
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
              className="w-full px-4 py-2 bg-secondary rounded-lg"
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
              className="w-full px-4 py-2 bg-secondary rounded-lg resize-none h-20"
              placeholder="Опциональные заметки..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-secondary rounded-lg hover:bg-muted"
          >
            Отмена
          </button>
          <button
            onClick={() => onReview(status, action, notes)}
            disabled={isLoading}
            className="flex-1 py-2 bg-red-600 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </div>
  );
}
