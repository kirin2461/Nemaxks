import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layout, Search, Users, GraduationCap, Gamepad2, Briefcase,
  BookOpen, MessageCircle, Video, PenTool, Mic, FileText,
  ChevronRight, Star, Crown, Zap, Building, Lock, Code, Calculator,
  Beaker, Globe, Landmark, BookMarked, Lightbulb, Presentation,
  Music, Languages, Database, Puzzle, BarChart, ClipboardList,
  Home, Scroll, FlaskConical, Atom, Dna, MapPin, CheckCircle
} from "lucide-react";
import { useStore } from "@/lib/store";
import { premiumAPI } from "@/lib/api";

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

interface GuildTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  required_plan: string;
  usage_count: number;
  channels_json: string;
}

interface ChannelTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: string;
  category: string;
  icon: string;
  required_plan: string;
  usage_count: number;
}

const toolTypeLabels: Record<string, string> = {
  notebook: "Тетради",
  whiteboard: "Доски",
  editor: "Редакторы",
};

const categoryLabels: Record<string, string> = {
  subjects: "Предметы",
  universal: "Универсальные",
  educational: "Учебные",
  creative: "Творческие",
  specialized: "Специализированные",
  programming: "Программирование",
  scientific: "Научные",
  documents: "Документы",
  teachers: "Для учителей",
  students: "Для учеников",
  group: "Групповая работа",
};

const iconMap: Record<string, React.ReactNode> = {
  calculator: <Calculator size={20} />,
  atom: <Atom size={20} />,
  flask: <Beaker size={20} />,
  dna: <Dna size={20} />,
  landmark: <Landmark size={20} />,
  globe: <Globe size={20} />,
  "book-open": <BookOpen size={20} />,
  "file-text": <FileText size={20} />,
  "graduation-cap": <GraduationCap size={20} />,
  microscope: <FlaskConical size={20} />,
  calendar: <ClipboardList size={20} />,
  ruler: <PenTool size={20} />,
  compass: <MapPin size={20} />,
  "test-tube": <Beaker size={20} />,
  map: <MapPin size={20} />,
  lightbulb: <Lightbulb size={20} />,
  "layout-kanban": <Layout size={20} />,
  presentation: <Presentation size={20} />,
  users: <Users size={20} />,
  music: <Music size={20} />,
  crown: <Crown size={20} />,
  languages: <Languages size={20} />,
  code: <Code size={20} />,
  puzzle: <Puzzle size={20} />,
  database: <Database size={20} />,
  trophy: <Star size={20} />,
  cpu: <Code size={20} />,
  "bar-chart": <BarChart size={20} />,
  sigma: <Calculator size={20} />,
  "clipboard-list": <ClipboardList size={20} />,
  "check-circle": <CheckCircle size={20} />,
  book: <BookMarked size={20} />,
  home: <Home size={20} />,
  scroll: <Scroll size={20} />,
  beaker: <Beaker size={20} />,
  "message-square": <MessageCircle size={20} />,
};

const planBadges: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: "Бесплатно", color: "bg-gray-600", icon: <Zap size={12} /> },
  edu_basic: { label: "Базовый", color: "bg-blue-600", icon: <Star size={12} /> },
  edu_pro: { label: "Про", color: "bg-purple-600", icon: <Crown size={12} /> },
};

type TabType = "notebooks" | "whiteboards" | "editors" | "servers" | "channels";

export function TemplatesPage() {
  const [, setLocation] = useLocation();
  const { user } = useStore();
  const [educationalTemplates, setEducationalTemplates] = useState<EducationalToolTemplate[]>([]);
  const [guildTemplates, setGuildTemplates] = useState<GuildTemplate[]>([]);
  const [channelTemplates, setChannelTemplates] = useState<ChannelTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("notebooks");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasPremium, setHasPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPremium() {
      if (!user?.id) {
        setLocation("/auth");
        return;
      }
      try {
        const res = await premiumAPI.getUserPremium(String(user.id));
        setHasPremium(res.has_premium);
      } catch {
        setHasPremium(false);
      }
      setLoading(false);
    }
    checkPremium();
  }, [user?.id, setLocation]);

  useEffect(() => {
    if (hasPremium) {
      fetchTemplates();
    }
  }, [hasPremium]);

  async function fetchTemplates() {
    try {
      const [eduRes, guildRes, channelRes] = await Promise.all([
        fetch("/api/templates/educational"),
        fetch("/api/templates/guilds"),
        fetch("/api/templates/channels"),
      ]);

      if (eduRes.ok) setEducationalTemplates(await eduRes.json());
      if (guildRes.ok) setGuildTemplates(await guildRes.json());
      if (channelRes.ok) setChannelTemplates(await channelRes.json());
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  }

  const getFilteredEducationalTemplates = (toolType: string) => {
    return educationalTemplates
      .filter((t) => t.tool_type === toolType)
      .filter((t) => 
        !categoryFilter || t.category === categoryFilter
      )
      .filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  const getCategoriesForType = (toolType: string) => {
    const categories = new Set<string>();
    educationalTemplates
      .filter((t) => t.tool_type === toolType)
      .forEach((t) => categories.add(t.category));
    return Array.from(categories);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!hasPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800/50 border border-gray-700 rounded-2xl p-10"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Премиум функция</h1>
            <p className="text-gray-400 mb-8">
              Образовательные шаблоны доступны только для премиум пользователей. 
              Оформите подписку, чтобы получить доступ к тетрадям, доскам и редакторам.
            </p>
            <button
              onClick={() => setLocation("/premium")}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto"
            >
              <Crown size={20} />
              Оформить премиум
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "notebooks" as TabType, label: "Тетради", icon: <BookOpen size={18} />, count: educationalTemplates.filter(t => t.tool_type === "notebook").length },
    { id: "whiteboards" as TabType, label: "Доски", icon: <PenTool size={18} />, count: educationalTemplates.filter(t => t.tool_type === "whiteboard").length },
    { id: "editors" as TabType, label: "Редакторы", icon: <Code size={18} />, count: educationalTemplates.filter(t => t.tool_type === "editor").length },
    { id: "servers" as TabType, label: "Серверы", icon: <Building size={18} />, count: guildTemplates.length },
    { id: "channels" as TabType, label: "Каналы", icon: <MessageCircle size={18} />, count: channelTemplates.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-2 rounded-full mb-4">
            <Layout size={20} className="text-purple-400" />
            <span className="text-purple-300 font-medium">Образовательные инструменты</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Шаблоны и инструменты
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Интерактивные тетради, доски для совместной работы и редакторы для обучения
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCategoryFilter("");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-white/20" : "bg-gray-700"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {(activeTab === "notebooks" || activeTab === "whiteboards" || activeTab === "editors") && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="">Все категории</option>
              {getCategoriesForType(activeTab === "notebooks" ? "notebook" : activeTab === "whiteboards" ? "whiteboard" : "editor").map((cat) => (
                <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
              ))}
            </select>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "notebooks" && (
            <motion.div
              key="notebooks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {getFilteredEducationalTemplates("notebook").map((template) => (
                <EducationalTemplateCard key={template.id} template={template} />
              ))}
              {getFilteredEducationalTemplates("notebook").length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Шаблоны не найдены
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "whiteboards" && (
            <motion.div
              key="whiteboards"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {getFilteredEducationalTemplates("whiteboard").map((template) => (
                <EducationalTemplateCard key={template.id} template={template} />
              ))}
              {getFilteredEducationalTemplates("whiteboard").length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Шаблоны не найдены
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "editors" && (
            <motion.div
              key="editors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {getFilteredEducationalTemplates("editor").map((template) => (
                <EducationalTemplateCard key={template.id} template={template} />
              ))}
              {getFilteredEducationalTemplates("editor").length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Шаблоны не найдены
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "servers" && (
            <motion.div
              key="servers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {guildTemplates
                .filter((t) =>
                  t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((template) => (
                  <GuildTemplateCard key={template.id} template={template} />
                ))}
              {guildTemplates.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Шаблоны серверов не найдены
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {channelTemplates
                .filter((t) =>
                  t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((template) => (
                  <ChannelTemplateCard key={template.id} template={template} />
                ))}
              {channelTemplates.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Шаблоны каналов не найдены
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EducationalTemplateCard({ template }: { template: EducationalToolTemplate }) {
  const plan = planBadges[template.required_plan] || planBadges.free;
  const icon = iconMap[template.icon] || <FileText size={20} />;

  const typeColors: Record<string, string> = {
    notebook: "from-blue-600/20 to-cyan-600/20 text-blue-400",
    whiteboard: "from-green-600/20 to-emerald-600/20 text-green-400",
    editor: "from-orange-600/20 to-amber-600/20 text-orange-400",
  };

  const buttonColors: Record<string, string> = {
    notebook: "bg-blue-600 hover:bg-blue-700",
    whiteboard: "bg-green-600 hover:bg-green-700",
    editor: "bg-orange-600 hover:bg-orange-700",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-br ${typeColors[template.tool_type]} rounded-lg`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{template.name}</h3>
            <p className="text-xs text-gray-400">
              {categoryLabels[template.category] || template.category}
            </p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${plan.color}`}>
          {plan.icon}
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{template.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{template.usage_count} использований</span>
        <button className={`flex items-center gap-2 px-4 py-2 ${buttonColors[template.tool_type]} rounded-lg text-sm font-medium transition-colors`}>
          Использовать
          <ChevronRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function GuildTemplateCard({ template }: { template: GuildTemplate }) {
  const plan = planBadges[template.required_plan] || planBadges.free;

  const categoryIcons: Record<string, React.ReactNode> = {
    community: <Users size={20} />,
    education: <GraduationCap size={20} />,
    gaming: <Gamepad2 size={20} />,
    business: <Briefcase size={20} />,
  };

  let channels: { name: string; type: string }[] = [];
  try {
    channels = JSON.parse(template.channels_json || "[]");
  } catch {}

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
            {categoryIcons[template.category] || <Building size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-white">{template.name}</h3>
            <p className="text-xs text-gray-400">{template.usage_count} использований</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${plan.color}`}>
          {plan.icon}
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">{template.description}</p>

      {channels.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Каналы ({channels.length}):</p>
          <div className="flex flex-wrap gap-1">
            {channels.slice(0, 5).map((ch, i) => (
              <span key={i} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                #{ch.name}
              </span>
            ))}
            {channels.length > 5 && (
              <span className="px-2 py-1 text-xs text-gray-500">+{channels.length - 5}</span>
            )}
          </div>
        </div>
      )}

      <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors">
        Использовать шаблон
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}

function ChannelTemplateCard({ template }: { template: ChannelTemplate }) {
  const plan = planBadges[template.required_plan] || planBadges.free;

  const typeIcons: Record<string, React.ReactNode> = {
    text: <MessageCircle size={20} />,
    voice: <Mic size={20} />,
    video: <Video size={20} />,
    board: <PenTool size={20} />,
    notebook: <BookOpen size={20} />,
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
            {typeIcons[template.type] || <MessageCircle size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-white">{template.name}</h3>
            <p className="text-xs text-gray-400">{template.type} · {template.usage_count} использований</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${plan.color}`}>
          {plan.icon}
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">{template.description}</p>

      <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
        Добавить канал
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}

export default TemplatesPage;
