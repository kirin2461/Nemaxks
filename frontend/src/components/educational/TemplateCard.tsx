import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, PenTool, Code, Calculator, Atom, Beaker, Dna, Landmark,
  Globe, FileText, GraduationCap, Lightbulb, Presentation, Music,
  Languages, Database, Puzzle, BarChart, ClipboardList, CheckCircle,
  BookMarked, Home, Scroll, MessageCircle, Users, MapPin, Crown,
  Star, Zap, ChevronRight, Eye, Download, Play, Lock, Sparkles
} from "lucide-react";

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

interface TemplateCardProps {
  template: EducationalToolTemplate;
  userPlan?: string;
  onApply?: (template: EducationalToolTemplate) => void;
  onPreview?: (template: EducationalToolTemplate) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  calculator: <Calculator size={24} />,
  atom: <Atom size={24} />,
  flask: <Beaker size={24} />,
  dna: <Dna size={24} />,
  landmark: <Landmark size={24} />,
  globe: <Globe size={24} />,
  "book-open": <BookOpen size={24} />,
  "file-text": <FileText size={24} />,
  "graduation-cap": <GraduationCap size={24} />,
  microscope: <Beaker size={24} />,
  calendar: <ClipboardList size={24} />,
  ruler: <PenTool size={24} />,
  compass: <MapPin size={24} />,
  "test-tube": <Beaker size={24} />,
  map: <MapPin size={24} />,
  lightbulb: <Lightbulb size={24} />,
  "layout-kanban": <ClipboardList size={24} />,
  presentation: <Presentation size={24} />,
  users: <Users size={24} />,
  music: <Music size={24} />,
  crown: <Crown size={24} />,
  languages: <Languages size={24} />,
  code: <Code size={24} />,
  puzzle: <Puzzle size={24} />,
  database: <Database size={24} />,
  trophy: <Star size={24} />,
  cpu: <Code size={24} />,
  "bar-chart": <BarChart size={24} />,
  sigma: <Calculator size={24} />,
  "clipboard-list": <ClipboardList size={24} />,
  "check-circle": <CheckCircle size={24} />,
  book: <BookMarked size={24} />,
  home: <Home size={24} />,
  scroll: <Scroll size={24} />,
  beaker: <Beaker size={24} />,
  "message-square": <MessageCircle size={24} />,
};

const planConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  free: { label: "Бесплатно", color: "text-gray-300", bgColor: "bg-gray-700", icon: <Zap size={14} /> },
  edu_basic: { label: "Базовый", color: "text-blue-300", bgColor: "bg-blue-600/80", icon: <Star size={14} /> },
  edu_pro: { label: "Про", color: "text-purple-300", bgColor: "bg-purple-600/80", icon: <Crown size={14} /> },
};

const toolTypeConfig: Record<string, { gradient: string; hoverGradient: string; accent: string }> = {
  notebook: {
    gradient: "from-blue-600/20 via-cyan-600/10 to-transparent",
    hoverGradient: "group-hover:from-blue-600/30 group-hover:via-cyan-600/20",
    accent: "text-blue-400",
  },
  whiteboard: {
    gradient: "from-green-600/20 via-emerald-600/10 to-transparent",
    hoverGradient: "group-hover:from-green-600/30 group-hover:via-emerald-600/20",
    accent: "text-green-400",
  },
  editor: {
    gradient: "from-orange-600/20 via-amber-600/10 to-transparent",
    hoverGradient: "group-hover:from-orange-600/30 group-hover:via-amber-600/20",
    accent: "text-orange-400",
  },
};

export function TemplateCard({ template, userPlan = "free", onApply, onPreview }: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const plan = planConfig[template.required_plan] || planConfig.free;
  const typeConfig = toolTypeConfig[template.tool_type] || toolTypeConfig.notebook;
  const icon = iconMap[template.icon] || <FileText size={24} />;

  const canAccess = 
    template.required_plan === "free" ||
    (template.required_plan === "edu_basic" && (userPlan === "edu_basic" || userPlan === "edu_pro")) ||
    (template.required_plan === "edu_pro" && userPlan === "edu_pro");

  let features: string[] = [];
  try {
    const config = JSON.parse(template.config_json || "{}");
    features = config.features || config.sections || config.tools || [];
  } catch {}

  return (
    <motion.div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`relative overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-800/40 backdrop-blur-sm transition-all duration-300 ${isHovered ? "border-gray-600 shadow-xl shadow-black/20" : ""}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.gradient} ${typeConfig.hoverGradient} transition-all duration-300`} />
        
        <div className="relative p-5">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${typeConfig.gradient} border border-white/5 ${typeConfig.accent}`}>
              {icon}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${plan.bgColor} text-xs font-medium ${plan.color}`}>
              {plan.icon}
              {plan.label}
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mb-1.5">{template.name}</h3>
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">{template.description}</p>

          {features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {features.slice(0, 4).map((feature, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-gray-300"
                >
                  {feature}
                </span>
              ))}
              {features.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-gray-500">+{features.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Download size={14} />
              <span>{template.usage_count.toLocaleString()} использований</span>
            </div>

            <div className="flex gap-2">
              {onPreview && (
                <button
                  onClick={() => onPreview(template)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <Eye size={16} />
                </button>
              )}
              
              {canAccess ? (
                <button
                  onClick={() => onApply?.(template)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    template.tool_type === "notebook"
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : template.tool_type === "whiteboard"
                      ? "bg-green-600 hover:bg-green-500 text-white"
                      : "bg-orange-600 hover:bg-orange-500 text-white"
                  }`}
                >
                  <Play size={14} />
                  Открыть
                </button>
              ) : (
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  disabled
                >
                  <Lock size={14} />
                  {plan.label}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-700" />
        <div className="w-20 h-6 rounded-full bg-gray-700" />
      </div>
      <div className="h-5 bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-700 rounded w-full mb-1" />
      <div className="h-4 bg-gray-700 rounded w-2/3 mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-5 w-16 bg-gray-700 rounded" />
        <div className="h-5 w-16 bg-gray-700 rounded" />
      </div>
      <div className="flex justify-between pt-3 border-t border-gray-700/50">
        <div className="h-4 w-24 bg-gray-700 rounded" />
        <div className="h-8 w-24 bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export function FeaturedTemplateCard({ template, onApply, userPlan = "free", hasPremium = false }: { 
  template: EducationalToolTemplate; 
  onApply?: (t: EducationalToolTemplate) => void;
  userPlan?: string;
  hasPremium?: boolean;
}) {
  const typeConfig = toolTypeConfig[template.tool_type] || toolTypeConfig.notebook;
  const icon = iconMap[template.icon] || <FileText size={32} />;

  const canAccess = () => {
    if (template.required_plan === "free") return true;
    if (template.required_plan === "edu_basic" && (userPlan === "edu_basic" || userPlan === "edu_pro" || hasPremium)) return true;
    if (template.required_plan === "edu_pro" && (userPlan === "edu_pro" || hasPremium)) return true;
    return false;
  };

  const isLocked = !canAccess();

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-3xl border border-gray-700/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.gradient} opacity-50`} />
      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
        <Sparkles size={14} />
        Рекомендуем
      </div>
      
      <div className="relative p-8">
        <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${typeConfig.gradient} border border-white/10 ${typeConfig.accent} mb-6`}>
          {icon}
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">{template.name}</h3>
        <p className="text-gray-400 mb-6 max-w-md">{template.description}</p>
        
        {isLocked ? (
          <button
            disabled
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 text-gray-400 rounded-xl font-medium cursor-not-allowed"
          >
            <Lock size={18} />
            Требуется {template.required_plan === "edu_pro" ? "Pro" : "Basic"} план
          </button>
        ) : (
          <button
            onClick={() => onApply?.(template)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
            <Play size={18} />
            Начать работу
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default TemplateCard;
