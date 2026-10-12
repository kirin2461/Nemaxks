import { motion, AnimatePresence } from "framer-motion";
import { X, Play, BookOpen, PenTool, Code, Star, Crown, Zap, CheckCircle } from "lucide-react";

interface EducationalToolTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  tool_type: string;
  category: string;
  sub_category: string;
  icon: string;
  required_plan: string;
  usage_count: number;
  config_json: string;
  features_json: string;
}

interface TemplatePreviewModalProps {
  template: EducationalToolTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: EducationalToolTemplate) => void;
  userPlan?: string;
}

const planConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: "Бесплатно", color: "text-muted-foreground", icon: <Zap size={16} /> },
  edu_basic: { label: "Базовый план", color: "text-blue-400", icon: <Star size={16} /> },
  edu_pro: { label: "Про план", color: "text-purple-400", icon: <Crown size={16} /> },
};

const toolTypeIcons: Record<string, React.ReactNode> = {
  notebook: <BookOpen size={24} />,
  whiteboard: <PenTool size={24} />,
  editor: <Code size={24} />,
};

const toolTypeLabels: Record<string, string> = {
  notebook: "Интерактивная тетрадь",
  whiteboard: "Интерактивная доска",
  editor: "Редактор кода",
};

export function TemplatePreviewModal({ template, isOpen, onClose, onApply, userPlan = "free" }: TemplatePreviewModalProps) {
  if (!template) return null;

  const plan = planConfig[template.required_plan] || planConfig.free;
  const canAccess = 
    template.required_plan === "free" ||
    (template.required_plan === "edu_basic" && (userPlan === "edu_basic" || userPlan === "edu_pro")) ||
    (template.required_plan === "edu_pro" && userPlan === "edu_pro");

  let features: string[] = [];
  let sections: string[] = [];
  try {
    const config = JSON.parse(template.config_json || "{}");
    features = config.features || config.tools || [];
    sections = config.sections || [];
  } catch {}

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[85vh] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  template.tool_type === "notebook" ? "bg-blue-600/20 text-blue-400" :
                  template.tool_type === "whiteboard" ? "bg-green-600/20 text-green-400" :
                  "bg-orange-600/20 text-orange-400"
                }`}>
                  {toolTypeIcons[template.tool_type]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{template.name}</h2>
                  <p className="text-sm text-muted-foreground">{toolTypeLabels[template.tool_type]}</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Описание</h3>
                <p className="text-foreground">{template.description}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${plan.color}`}>
                  {plan.icon}
                  <span className="font-medium">{plan.label}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {template.usage_count.toLocaleString()} использований
                </div>
              </div>

              {features.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Возможности</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-card/50 rounded-lg">
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <span className="text-sm text-foreground capitalize">{feature.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Разделы</h3>
                  <div className="flex flex-wrap gap-2">
                    {sections.map((section, i) => (
                      <span key={i} className="px-3 py-1.5 bg-card/50 rounded-lg text-sm text-foreground capitalize">
                        {section.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl">
                <h4 className="font-medium text-foreground mb-2">Как использовать</h4>
                <p className="text-sm text-muted-foreground">
                  Нажмите "Открыть шаблон", чтобы создать новый документ на основе этого шаблона. 
                  Все настройки и инструменты будут готовы к использованию.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-card hover:bg-secondary text-foreground rounded-xl font-medium transition-colors"
              >
                Закрыть
              </button>
              
              {canAccess ? (
                <button
                  onClick={() => {
                    onApply(template);
                    onClose();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                    template.tool_type === "notebook" ? "bg-blue-600 hover:bg-blue-500" :
                    template.tool_type === "whiteboard" ? "bg-green-600 hover:bg-green-500" :
                    "bg-orange-600 hover:bg-orange-500"
                  } text-white`}
                >
                  <Play size={18} />
                  Открыть шаблон
                </button>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
                >
                  <Crown size={18} />
                  Улучшить план
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default TemplatePreviewModal;
