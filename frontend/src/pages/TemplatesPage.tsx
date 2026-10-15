import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, GraduationCap, Gamepad2, Briefcase,
  BookOpen, MessageCircle, Video, PenTool, Mic,
  ChevronRight, Crown, Building, Code,
  Sparkles
} from "lucide-react";
import { useStore } from "@/lib/store";
import { premiumAPI } from "@/lib/api";
import { TemplateCard, FeaturedTemplateCard } from "@/components/educational/TemplateCard";
import { CategoryFilter } from "@/components/educational/CategoryFilter";
import { TemplatePreviewModal } from "@/components/educational/TemplatePreviewModal";
import { cn } from "@/lib/utils";

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

const planBadges: Record<string, { label: string; color: string }> = {
  free: { label: "Бесплатно", color: "bg-secondary text-secondary-foreground" },
  edu_basic: { label: "Базовый", color: "bg-accent text-accent-foreground border border-emerald-200" },
  edu_pro: { label: "Про", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
};

const primaryButtonClass =
  "w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TemplatesPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useStore();

  const tabs = [
    { id: "notebooks" as TabType, label: t("templates.notebooks"), icon: <BookOpen size={18} strokeWidth={1.75} />, toolType: "notebook" },
    { id: "whiteboards" as TabType, label: t("templates.whiteboards"), icon: <PenTool size={18} strokeWidth={1.75} />, toolType: "whiteboard" },
    { id: "editors" as TabType, label: t("templates.editors"), icon: <Code size={18} strokeWidth={1.75} />, toolType: "editor" },
    { id: "servers" as TabType, label: t("nav.servers"), icon: <Building size={18} strokeWidth={1.75} />, toolType: null },
    { id: "channels" as TabType, label: t("nav.channels"), icon: <MessageCircle size={18} strokeWidth={1.75} />, toolType: null },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="skeleton h-10 w-72 mx-auto" />
          <div className="skeleton h-4 w-96 mx-auto" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const premiumBanner = !hasPremium && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-4 rounded-xl border border-emerald-200 bg-accent/30"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-lg-brand">
            <Crown className="text-primary-foreground" size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-foreground font-medium">{t("templates.unlockWith")} {t("common.premium")}</p>
            <p className="text-muted-foreground text-sm">{freeTemplatesCount} {t("templates.access.free")}</p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/premium")}
          className={cn(primaryButtonClass, "w-auto px-6 whitespace-nowrap")}
        >
          {t("premium.upgrade")}
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 mb-4">
            <Sparkles size={14} strokeWidth={1.75} />
            {t("nav.templates")}
          </span>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-graphite-900 tracking-[-0.02em] mb-3">
            {t("templates.title")}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            {t("templates.subtitle")}
          </p>
        </motion.div>

        {premiumBanner}

        {/* Segmented tabs (design.md §6.12) */}
        <div className="flex flex-wrap gap-1 mb-8 justify-center">
          <div className="inline-flex flex-wrap justify-center p-1 rounded-lg bg-secondary gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCategoryFilter("");
                }}
                className={cn(
                  "flex items-center gap-2 h-8 px-3 rounded-md text-sm transition-all duration-150",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-soft font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
                <span className={cn(
                  "text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-emerald-100 text-emerald-800" : "bg-graphite-200 text-graphite-600"
                )}>
                  {templateCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-[520px] mx-auto w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-400" size={20} strokeWidth={1.75} />
            <input
              type="text"
              placeholder={t("templates.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 h-12 text-base"
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
                <div className="text-center py-16 px-6 animate-rise-in">
                  <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                    <Search size={48} strokeWidth={1.5} className="text-graphite-300" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mt-4">Шаблоны не найдены</p>
                  <p className="text-sm text-muted-foreground max-w-[320px] mx-auto mt-1">Попробуйте изменить фильтры или поисковый запрос</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "servers" && (
            <motion.div
              key="servers"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
                <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                  Шаблоны серверов не найдены
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
                <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
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
  const plan = planBadges[template.required_plan] || planBadges.free;

  const categoryIcons: Record<string, React.ReactNode> = {
    community: <Users size={20} strokeWidth={1.75} />,
    education: <GraduationCap size={20} strokeWidth={1.75} />,
    gaming: <Gamepad2 size={20} strokeWidth={1.75} />,
    business: <Briefcase size={20} strokeWidth={1.75} />,
  };

  let channels: { name: string; type: string }[] = [];
  try {
    channels = JSON.parse(template.channels_json || "[]");
  } catch {}

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-card p-5 shadow-soft hover:shadow-elev hover:border-graphite-300 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-accent border border-emerald-200 rounded-xl text-emerald-700 shrink-0">
            {categoryIcons[template.category] || <Building size={20} strokeWidth={1.75} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.usage_count} использований</p>
          </div>
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium shrink-0", plan.color)}>
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

      {channels.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Каналы ({channels.length}):</p>
          <div className="flex flex-wrap gap-1.5">
            {channels.slice(0, 5).map((ch, i) => (
              <span key={i} className="px-2 py-1 bg-secondary rounded-lg text-xs text-secondary-foreground">
                #{ch.name}
              </span>
            ))}
            {channels.length > 5 && (
              <span className="px-2 py-1 text-xs text-muted-foreground">+{channels.length - 5}</span>
            )}
          </div>
        </div>
      )}

      <button className={primaryButtonClass}>
        Использовать шаблон
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

function ChannelTemplateCard({ template }: { template: ChannelTemplate }) {
  const plan = planBadges[template.required_plan] || planBadges.free;

  const typeIcons: Record<string, React.ReactNode> = {
    text: <MessageCircle size={20} strokeWidth={1.75} />,
    voice: <Mic size={20} strokeWidth={1.75} />,
    video: <Video size={20} strokeWidth={1.75} />,
    board: <PenTool size={20} strokeWidth={1.75} />,
    notebook: <BookOpen size={20} strokeWidth={1.75} />,
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-card p-5 shadow-soft hover:shadow-elev hover:border-graphite-300 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-accent border border-emerald-200 rounded-xl text-emerald-700 shrink-0">
            {typeIcons[template.type] || <MessageCircle size={20} strokeWidth={1.75} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.type} · {template.usage_count} использований</p>
          </div>
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium shrink-0", plan.color)}>
          {plan.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

      <button className={primaryButtonClass}>
        Добавить канал
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

export default TemplatesPage;
