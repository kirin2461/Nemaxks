import { motion } from "framer-motion";
import {
  BookOpen, PenTool, Code, GraduationCap, Briefcase, Users,
  Lightbulb, FlaskConical, FileCode, Palette, LayoutGrid
} from "lucide-react";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  toolType: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  subjects: { label: "Предметы", icon: <GraduationCap size={18} /> },
  universal: { label: "Универсальные", icon: <LayoutGrid size={18} /> },
  educational: { label: "Учебные", icon: <BookOpen size={18} /> },
  creative: { label: "Творческие", icon: <Palette size={18} /> },
  specialized: { label: "Специальные", icon: <FlaskConical size={18} /> },
  programming: { label: "Программирование", icon: <Code size={18} /> },
  scientific: { label: "Научные", icon: <FlaskConical size={18} /> },
  documents: { label: "Документы", icon: <FileCode size={18} /> },
  teachers: { label: "Для учителей", icon: <Briefcase size={18} /> },
  students: { label: "Для учеников", icon: <Users size={18} /> },
  group: { label: "Групповая работа", icon: <Users size={18} /> },
};

const toolTypeColors: Record<string, { bg: string; text: string; activeBg: string }> = {
  notebook: { bg: "bg-primary/10", text: "text-primary", activeBg: "bg-primary shadow-lg-brand" },
  whiteboard: { bg: "bg-accent/10", text: "text-emerald-700", activeBg: "bg-accent" },
  editor: { bg: "bg-warning-soft", text: "text-warning", activeBg: "bg-warning" },
};

export function CategoryFilter({ categories, selectedCategory, onSelect, toolType }: CategoryFilterProps) {
  const colors = toolTypeColors[toolType] || toolTypeColors.notebook;

  return (
    <div className="flex flex-wrap gap-2">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect("")}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
          selectedCategory === ""
            ? `${colors.activeBg} text-white shadow-elev`
            : `${colors.bg} ${colors.text} hover:bg-opacity-20`
        }`}
      >
        <LayoutGrid size={18} />
        Все
      </motion.button>

      {categories.map((cat) => {
        const config = categoryConfig[cat] || { label: cat, icon: <LayoutGrid size={18} /> };
        return (
          <motion.button
            key={cat}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(cat)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              selectedCategory === cat
                ? `${colors.activeBg} text-white shadow-elev`
                : `${colors.bg} ${colors.text} hover:bg-opacity-20`
            }`}
          >
            {config.icon}
            {config.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export default CategoryFilter;
