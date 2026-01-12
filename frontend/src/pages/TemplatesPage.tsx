import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Layout, Search, Users, GraduationCap, Gamepad2, Briefcase,
  BookOpen, MessageCircle, Video, PenTool, Mic, FileText,
  ChevronRight, Star, Crown, Zap, Building
} from "lucide-react";

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

const categoryIcons: Record<string, React.ReactNode> = {
  community: <Users size={20} />,
  education: <GraduationCap size={20} />,
  gaming: <Gamepad2 size={20} />,
  business: <Briefcase size={20} />,
};

const channelTypeIcons: Record<string, React.ReactNode> = {
  text: <MessageCircle size={20} />,
  voice: <Mic size={20} />,
  video: <Video size={20} />,
  board: <PenTool size={20} />,
  notebook: <BookOpen size={20} />,
};

const planBadges: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: "Free", color: "bg-gray-600", icon: <Zap size={12} /> },
  edu_basic: { label: "Edu Basic", color: "bg-blue-600", icon: <Star size={12} /> },
  edu_pro: { label: "Edu Pro", color: "bg-purple-600", icon: <Crown size={12} /> },
};

export function TemplatesPage() {
  const [guildTemplates, setGuildTemplates] = useState<GuildTemplate[]>([]);
  const [channelTemplates, setChannelTemplates] = useState<ChannelTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<"guild" | "channel">("guild");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [categoryFilter, planFilter]);

  async function fetchTemplates() {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append("category", categoryFilter);
      if (planFilter) params.append("plan", planFilter);

      const [guildRes, channelRes] = await Promise.all([
        fetch(`/api/templates/guilds?${params}`),
        fetch(`/api/templates/channels?${params}`),
      ]);

      if (guildRes.ok) setGuildTemplates(await guildRes.json());
      if (channelRes.ok) setChannelTemplates(await channelRes.json());
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  }

  const filteredGuildTemplates = guildTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChannelTemplates = channelTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-2 rounded-full mb-4">
            <Layout size={20} className="text-purple-400" />
            <span className="text-purple-300 font-medium">Шаблоны</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Готовые шаблоны серверов и каналов
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Выберите шаблон для быстрого создания сервера или канала с предустановленными настройками
          </p>
        </motion.div>

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

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="">Все категории</option>
              <option value="education">Образование</option>
              <option value="gaming">Игры</option>
              <option value="community">Сообщество</option>
              <option value="business">Бизнес</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="">Все планы</option>
              <option value="free">Free</option>
              <option value="edu_basic">Edu Basic</option>
              <option value="edu_pro">Edu Pro</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("guild")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "guild"
                ? "bg-purple-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
            }`}
          >
            <Building size={18} />
            Серверы
          </button>
          <button
            onClick={() => setActiveTab("channel")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "channel"
                ? "bg-purple-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
            }`}
          >
            <MessageCircle size={18} />
            Каналы
          </button>
        </div>

        {activeTab === "guild" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredGuildTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} type="guild" />
            ))}
            {filteredGuildTemplates.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                Шаблоны не найдены
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "channel" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredChannelTemplates.map((template) => (
              <ChannelTemplateCard key={template.id} template={template} />
            ))}
            {filteredChannelTemplates.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                Шаблоны не найдены
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, type }: { template: GuildTemplate; type: string }) {
  const plan = planBadges[template.required_plan] || planBadges.free;
  const categoryIcon = categoryIcons[template.category] || <Layout size={20} />;

  let channels: { name: string; type: string }[] = [];
  try {
    channels = JSON.parse(template.channels_json || "[]");
  } catch {}

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
            {categoryIcon}
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
  const typeIcon = channelTypeIcons[template.type] || <MessageCircle size={20} />;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
            {typeIcon}
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
