import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layout, Search, Users, GraduationCap, Gamepad2, Briefcase,
  BookOpen, MessageCircle, Video, PenTool, Mic, FileText,
  ChevronRight, Star, Crown, Zap, Building, Lock, Code,
  Sparkles, Filter, Grid3X3, List
} from "lucide-react";
import { useStore } from "@/lib/store";
import { premiumAPI } from "@/lib/api";
import { TemplateCard, TemplateCardSkeleton, FeaturedTemplateCard } from "@/components/educational/TemplateCard";
import { CategoryFilter } from "@/components/educational/CategoryFilter";
import { TemplatePreviewModal } from "@/components/educational/TemplatePreviewModal";

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

type TabType = "notebooks" | "whiteboards" | "editors" | "servers" | "channels";

export function TemplatesPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useStore();
  
  const tabs = [
    { id: "notebooks" as TabType, label: t("templates.notebooks"), icon: <BookOpen size={18} />, toolType: "notebook", color: "blue" },
    { id: "whiteboards" as TabType, label: t("templates.whiteboards"), icon: <PenTool size={18} />, toolType: "whiteboard", color: "green" },
    { id: "editors" as TabType, label: t("templates.editors"), icon: <Code size={18} />, toolType: "editor", color: "orange" },
    { id: "servers" as TabType, label: t("nav.servers"), icon: <Building size={18} />, toolType: null, color: "purple" },
    { id: "channels" as TabType, label: t("nav.channels"), icon: <MessageCircle size={18} />, toolType: null, color: "cyan" },
  ];
  const [educationalTemplates, setEducationalTemplates] = useState<EducationalToolTemplate[]>([]);
  const [guildTemplates, setGuildTemplates] = useState<GuildTemplate[]>([]);
  const [channelTemplates, setChannelTemplates] = useState<ChannelTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("notebooks");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasPremium, setHasPremium] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<EducationalToolTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    async function checkPremium() {
      if (!user?.id) {
        setLocation("/auth");
        return;
      }
      try {
        const res = await premiumAPI.getUserPremium(String(user.id));
        setHasPremium(res.has_premium);
        setUserPlan(res.plan_name || "free");
      } catch {
        setHasPremium(false);
      }
      setLoading(false);
    }
    checkPremium();
  }, [user?.id, setLocation]);

  useEffect(() => {
    if (user?.id) {
      fetchTemplates();
    }
  }, [user?.id]);

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

  async function applyTemplate(template: EducationalToolTemplate) {
    if (applying) return;
    setApplying(true);
    
    try {
      const res = await fetch(`/api/templates/educational/${template.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.channel_id) {
          setLocation(`/channels?channel=${data.channel_id}`);
        }
      } else {
        console.error("Failed to apply template");
      }
    } catch (err) {
      console.error("Error applying template:", err);
    } finally {
      setApplying(false);
    }
  }

  const getFilteredEducationalTemplates = (toolType: string) => {
    return educationalTemplates
      .filter((t) => t.tool_type === toolType)
      .filter((t) => !categoryFilter || t.category === categoryFilter)
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

  const currentToolType = tabs.find(t => t.id === activeTab)?.toolType || "notebook";
  const filteredTemplates = useMemo(() => {
    if (activeTab === "servers" || activeTab === "channels") return [];
    return getFilteredEducationalTemplates(currentToolType);
  }, [educationalTemplates, activeTab, categoryFilter, searchQuery, currentToolType]);

  const featuredTemplate = useMemo(() => {
    return filteredTemplates.find(t => t.required_plan === "free" && t.usage_count > 0) || filteredTemplates[0];
  }, [filteredTemplates]);

  const templateCounts = useMemo(() => ({
    notebooks: educationalTemplates.filter(t => t.tool_type === "notebook").length,
    whiteboards: educationalTemplates.filter(t => t.tool_type === "whiteboard").length,
    editors: educationalTemplates.filter(t => t.tool_type === "editor").length,
    servers: guildTemplates.length,
    channels: channelTemplates.length,
  }), [educationalTemplates, guildTemplates, channelTemplates]);

  const freeTemplatesCount = useMemo(() => 
    educationalTemplates.filter(t => t.required_plan === "free").length, 
    [educationalTemplates]
  );

  const canAccessTemplate = (plan: string) => {
    if (plan === "free") return true;
    if (plan === "edu_basic" && (userPlan === "edu_basic" || userPlan === "edu_pro" || hasPremium)) return true;
    if (plan === "edu_pro" && (userPlan === "edu_pro" || hasPremium)) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-nebula text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const premiumBanner = !hasPremium && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-4 glass rounded-2xl shadow-soft"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/15 rounded-lg">
            <Crown className="text-primary" size={24} />
          </div>
          <div>
            <p className="text-foreground font-medium">{t("templates.unlockWith")} {t("common.premium")}</p>
            <p className="text-muted-foreground text-sm">{freeTemplatesCount} {t("templates.access.free")}</p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/premium")}
          className="px-6 py-2.5 gradient-brand hover:brightness-110 rounded-xl font-medium text-sm text-primary-foreground shadow-soft whitespace-nowrap transition-all"
        >
          {t("premium.upgrade")}
        </button>
      </div>
    </motion.div>
  );

  /* Previously blocked non-premium users entirely - now showing all templates with access control
  if (!hasPremium) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-b from-card/50 to-background/50 border border-border rounded-3xl p-12"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-purple-600/30">
              <Lock size={48} className="text-muted-foreground" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Премиум функция
            </h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Образовательные шаблоны доступны только для премиум пользователей. 
              Оформите подписку, чтобы получить доступ к тетрадям, доскам и редакторам.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-600/20">
                <BookOpen className="text-blue-400 mx-auto mb-2" size={28} />
                <p className="text-sm text-foreground">11 тетрадей</p>
              </div>
              <div className="p-4 bg-green-600/10 rounded-xl border border-green-600/20">
                <PenTool className="text-green-400 mx-auto mb-2" size={28} />
                <p className="text-sm text-foreground">12 досок</p>
              </div>
              <div className="p-4 bg-orange-600/10 rounded-xl border border-orange-600/20">
                <Code className="text-orange-400 mx-auto mb-2" size={28} />
                <p className="text-sm text-foreground">10 редакторов</p>
              </div>
            </div>
            
            <button
              onClick={() => setLocation("/premium")}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium text-lg transition-all flex items-center gap-2 mx-auto shadow-lg shadow-purple-600/30"
            >
              <Crown size={22} />
              Оформить премиум
            </button>
          </motion.div>
        </div>
      </div>
    );
  }
  */

  return (
    <div className="min-h-screen bg-nebula text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/30 px-4 py-2 rounded-full mb-4">
            <Sparkles size={18} className="text-primary" />
            <span className="gradient-brand-text font-medium text-sm">{t("nav.templates")}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold gradient-brand-text mb-3">
            {t("templates.title")}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            {t("templates.subtitle")}
          </p>
        </motion.div>

        {premiumBanner}

        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCategoryFilter("");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? "gradient-brand text-primary-foreground shadow-soft"
                  : "glass text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-white/20" : "bg-primary/10 text-primary"
              }`}>
                {templateCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder={t("templates.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field !rounded-xl pl-12 py-3.5"
            />
          </div>
        </div>

        {(activeTab === "notebooks" || activeTab === "whiteboards" || activeTab === "editors") && (
          <div className="mb-8">
            <CategoryFilter
              categories={getCategoriesForType(currentToolType)}
              selectedCategory={categoryFilter}
              onSelect={setCategoryFilter}
              toolType={currentToolType}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {(activeTab === "notebooks" || activeTab === "whiteboards" || activeTab === "editors") && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {featuredTemplate && !categoryFilter && !searchQuery && (
                <FeaturedTemplateCard
                  template={featuredTemplate}
                  onApply={applyTemplate}
                  userPlan={userPlan}
                  hasPremium={hasPremium}
                />
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTemplates
                  .filter(t => t.id !== featuredTemplate?.id || categoryFilter || searchQuery)
                  .map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      userPlan={userPlan}
                      onApply={applyTemplate}
                      onPreview={setPreviewTemplate}
                    />
                  ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-lg">Шаблоны не найдены</p>
                  <p className="text-muted-foreground text-sm mt-1">Попробуйте изменить фильтры или поисковый запрос</p>
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
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
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
                <div className="col-span-full text-center py-16 text-muted-foreground">
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
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
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
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  Шаблоны каналов не найдены
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TemplatePreviewModal
        template={previewTemplate}
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onApply={applyTemplate}
        userPlan={userPlan}
      />
    </div>
  );
}

function GuildTemplateCard({ template }: { template: GuildTemplate }) {
  const planBadges: Record<string, { label: string; color: string }> = {
    free: { label: "Бесплатно", color: "bg-muted text-muted-foreground" },
    edu_basic: { label: "Базовый", color: "bg-accent/15 text-accent border border-accent/25" },
    edu_pro: { label: "Про", color: "bg-primary/15 text-primary border border-primary/25" },
  };
  
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
      whileHover={{ y: -4 }}
      className="glass rounded-2xl p-5 shadow-soft hover:border-primary/50 hover:shadow-glow transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/15 rounded-xl text-primary">
            {categoryIcons[template.category] || <Building size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.usage_count} использований</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${plan.color}`}>
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

      {channels.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Каналы ({channels.length}):</p>
          <div className="flex flex-wrap gap-1.5">
            {channels.slice(0, 5).map((ch, i) => (
              <span key={i} className="px-2 py-1 bg-background/50 border border-border rounded-lg text-xs text-foreground">
                #{ch.name}
              </span>
            ))}
            {channels.length > 5 && (
              <span className="px-2 py-1 text-xs text-muted-foreground">+{channels.length - 5}</span>
            )}
          </div>
        </div>
      )}

      <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-brand hover:brightness-110 text-primary-foreground shadow-soft rounded-xl font-medium transition-all">
        Использовать шаблон
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}

function ChannelTemplateCard({ template }: { template: ChannelTemplate }) {
  const planBadges: Record<string, { label: string; color: string }> = {
    free: { label: "Бесплатно", color: "bg-muted text-muted-foreground" },
    edu_basic: { label: "Базовый", color: "bg-accent/15 text-accent border border-accent/25" },
    edu_pro: { label: "Про", color: "bg-primary/15 text-primary border border-primary/25" },
  };
  
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
      whileHover={{ y: -4 }}
      className="glass rounded-2xl p-5 shadow-soft hover:border-accent/50 hover:shadow-glow transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-accent/15 rounded-xl text-accent">
            {typeIcons[template.type] || <MessageCircle size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.type} · {template.usage_count} использований</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${plan.color}`}>
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

      <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-brand hover:brightness-110 text-primary-foreground shadow-soft rounded-xl font-medium transition-all">
        Добавить канал
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}

export default TemplatesPage;
