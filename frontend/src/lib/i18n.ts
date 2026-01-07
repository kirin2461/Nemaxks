type TranslationKey = keyof typeof translations.ru

const translations = {
  ru: {
    'common.loading': 'Загрузка...',
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.delete': 'Удалить',
    'common.edit': 'Редактировать',
    'common.send': 'Отправить',
    'common.search': 'Поиск',
    'common.settings': 'Настройки',
    'common.logout': 'Выйти',
    'common.profile': 'Профиль',
    
    'nav.home': 'Главная',
    'nav.feed': 'Лента',
    'nav.messages': 'Сообщения',
    'nav.channels': 'Каналы',
    'nav.friends': 'Друзья',
    'nav.jarvis': 'Jarvis',
    'nav.admin': 'Админ',
    
    'auth.login': 'Войти',
    'auth.register': 'Регистрация',
    'auth.username': 'Имя пользователя',
    'auth.email': 'Email',
    'auth.password': 'Пароль',
    'auth.confirmPassword': 'Подтвердите пароль',
    
    'messages.newMessage': 'Новое сообщение',
    'messages.typeMessage': 'Введите сообщение...',
    'messages.noConversations': 'Нет диалогов',
    'messages.online': 'В сети',
    'messages.offline': 'Не в сети',
    'messages.typing': 'печатает...',
    'messages.read': 'Прочитано',
    
    'feed.newPost': 'Что нового?',
    'feed.publish': 'Опубликовать',
    'feed.likes': 'Нравится',
    'feed.comments': 'Комментарии',
    'feed.share': 'Поделиться',
    
    'stories.addStory': 'Добавить историю',
    'stories.yourStory': 'Ваша история',
    'stories.remaining': 'осталось',
    
    'friends.addFriend': 'Добавить друга',
    'friends.pending': 'Ожидают',
    'friends.all': 'Все друзья',
    'friends.online': 'В сети',
    'friends.blocked': 'Заблокированные',
    
    'channels.createChannel': 'Создать канал',
    'channels.textChannel': 'Текстовый канал',
    'channels.voiceChannel': 'Голосовой канал',
    'channels.members': 'Участники',
    
    'admin.dashboard': 'Панель управления',
    'admin.users': 'Пользователи',
    'admin.bans': 'Баны',
    'admin.reports': 'Жалобы',
    'admin.logs': 'Журнал',
    'admin.stats': 'Статистика',
    
    'settings.theme': 'Тема',
    'settings.language': 'Язык',
    'settings.notifications': 'Уведомления',
    'settings.sounds': 'Звуки',
    'settings.voiceActivation': 'Голосовая активация',
    'settings.noiseReduction': 'Шумоподавление',
    
    'jarvis.greeting': 'Привет! Я Jarvis, ваш AI-помощник.',
    'jarvis.askMe': 'Спросите меня что-нибудь...',
    'jarvis.voiceActivated': 'Голосовое управление активировано',
    'jarvis.listening': 'Слушаю...',
  },
  en: {
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.send': 'Send',
    'common.search': 'Search',
    'common.settings': 'Settings',
    'common.logout': 'Logout',
    'common.profile': 'Profile',
    
    'nav.home': 'Home',
    'nav.feed': 'Feed',
    'nav.messages': 'Messages',
    'nav.channels': 'Channels',
    'nav.friends': 'Friends',
    'nav.jarvis': 'Jarvis',
    'nav.admin': 'Admin',
    
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    
    'messages.newMessage': 'New message',
    'messages.typeMessage': 'Type a message...',
    'messages.noConversations': 'No conversations',
    'messages.online': 'Online',
    'messages.offline': 'Offline',
    'messages.typing': 'typing...',
    'messages.read': 'Read',
    
    'feed.newPost': "What's new?",
    'feed.publish': 'Publish',
    'feed.likes': 'Likes',
    'feed.comments': 'Comments',
    'feed.share': 'Share',
    
    'stories.addStory': 'Add story',
    'stories.yourStory': 'Your story',
    'stories.remaining': 'remaining',
    
    'friends.addFriend': 'Add friend',
    'friends.pending': 'Pending',
    'friends.all': 'All friends',
    'friends.online': 'Online',
    'friends.blocked': 'Blocked',
    
    'channels.createChannel': 'Create channel',
    'channels.textChannel': 'Text channel',
    'channels.voiceChannel': 'Voice channel',
    'channels.members': 'Members',
    
    'admin.dashboard': 'Dashboard',
    'admin.users': 'Users',
    'admin.bans': 'Bans',
    'admin.reports': 'Reports',
    'admin.logs': 'Logs',
    'admin.stats': 'Statistics',
    
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.notifications': 'Notifications',
    'settings.sounds': 'Sounds',
    'settings.voiceActivation': 'Voice activation',
    'settings.noiseReduction': 'Noise reduction',
    
    'jarvis.greeting': "Hello! I'm Jarvis, your AI assistant.",
    'jarvis.askMe': 'Ask me anything...',
    'jarvis.voiceActivated': 'Voice control activated',
    'jarvis.listening': 'Listening...',
  },
}

type Language = keyof typeof translations

let currentLanguage: Language = 'ru'

export function setLanguage(lang: Language) {
  currentLanguage = lang
  localStorage.setItem('language', lang)
}

export function getLanguage(): Language {
  const stored = localStorage.getItem('language') as Language
  if (stored && translations[stored]) {
    currentLanguage = stored
  }
  return currentLanguage
}

export function t(key: TranslationKey): string {
  return translations[currentLanguage][key] || translations.ru[key] || key
}

export function useTranslation() {
  const lang = getLanguage()
  return {
    t,
    language: lang,
    setLanguage,
  }
}
