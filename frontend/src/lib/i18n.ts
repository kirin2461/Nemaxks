import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from '../locales/ru.json';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  zh: { translation: zh }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    lng: localStorage.getItem('language') || 'ru',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('language', lang);
};

export const languages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
];

export default i18n;
