package main

var russianAgencies = []string{
        "фсб", "фсо", "свр", "мвд", "росгвардия", "следственный комитет",
        "прокуратура", "фсин", "фтс", "фнс", "роскомнадзор", "фас",
        "следователь", "прокурор", "полиция", "полицейский", "участковый",
        "оперуполномоченный", "дознаватель", "инспектор", "майор", "капитан",
        "подполковник", "полковник", "генерал", "лейтенант", "сержант",
        "федеральная служба безопасности", "министерство внутренних дел",
        "служба внешней разведки", "федеральная служба охраны",
        "национальная гвардия", "налоговая служба", "таможенная служба",
        "центробанк", "центральный банк", "банк россии", "сбербанк безопасность",
        "служба безопасности банка", "отдел безопасности", "управление к",
        "убэп", "обэп", "угро", "убоп", "гибдд", "гаи", "омон", "собр",
        "спецназ", "фскн", "госнаркоконтроль", "антитеррор", "цпэ",
        "судебный пристав", "судебный исполнитель", "приставы", "фссп",
        "арбитражный суд", "мировой суд", "районный суд", "верховный суд",
}

var russianAgencyAbbreviations = []string{
        "фсб", "фсо", "свр", "мвд", "скр", "фнс", "фтс", "фас", "фсин",
        "убэп", "обэп", "угро", "убоп", "цпэ", "фссп", "гибдд", "гаи",
}

var internationalAgencies = []string{
        "fbi", "cia", "nsa", "dea", "atf", "secret service", "homeland security",
        "interpol", "europol", "mi5", "mi6", "mossad", "bnd", "dgse",
        "federal bureau", "central intelligence", "national security agency",
        "drug enforcement", "alcohol tobacco firearms", "department of homeland",
}

var internationalAgencyAbbreviations = []string{
        "fbi", "cia", "nsa", "dea", "atf", "dhs", "ice", "cbp",
}

var rankKeywords = []string{
        "agent", "агент", "officer", "офицер", "detective", "детектив",
        "special agent", "специальный агент", "federal agent", "федеральный агент",
        "inspector", "инспектор", "investigator", "следователь",
        "captain", "капитан", "lieutenant", "лейтенант", "major", "майор",
        "colonel", "полковник", "general", "генерал", "sergeant", "сержант",
        "director", "директор", "chief", "начальник", "head of", "глава",
}

var impersonationPhrases = []string{
        "я сотрудник", "я работаю в", "я из", "я представляю",
        "вас вызывают", "вам звонят из", "против вас возбуждено",
        "уголовное дело", "вы подозреваетесь", "вы обвиняетесь",
        "вам необходимо явиться", "вас разыскивают", "ваш аккаунт заблокирован",
        "служба безопасности", "отдел по борьбе", "специальный отдел",
        "federal investigation", "under investigation", "you are wanted",
        "this is agent", "i'm calling from", "department of",
        "your account is flagged", "security department", "compliance officer",
        "на вас поступило заявление", "на вас написали заявление",
        "ваши данные скомпрометированы", "ваш счет взломан", "несанкционированный доступ",
        "подозрительная активность", "мошеннические операции", "отмывание денег",
        "финансирование терроризма", "экстремистская деятельность",
        "вам грозит", "вас могут задержать", "вас объявят в розыск",
        "заморозка счетов", "блокировка карты", "арест имущества",
        "штраф", "судебное преследование", "уголовная ответственность",
        "я старший оперуполномоченный", "я следователь по особо важным делам",
        "я из отдела по борьбе с мошенничеством", "я из экономической полиции",
        "ваш родственник задержан", "ваш сын попал в аварию", "ваша дочь в больнице",
        "нужны деньги на операцию", "нужен залог", "нужно заплатить за освобождение",
        "это конфиденциально", "никому не говорите", "не кладите трубку",
        "оставайтесь на линии", "вас переключат на специалиста",
}

var scamKeywords = []string{
        "бесплатные nemcoins", "бесплатные монеты", "free nemcoins", "free coins",
        "нажми сюда", "click here", "перейди по ссылке", "follow this link",
        "выиграй", "win free", "получи бесплатно", "get free",
        "твой аккаунт взломан", "your account hacked", "срочно", "urgent",
        "подтверди данные", "verify your data", "введи пароль", "enter password",
        "steam gift", "nitro бесплатно", "free nitro", "раздача",
        "giveaway", "airdrop", "crypto investment", "инвестиции",
        "удвоение", "doubling", "быстрый заработок", "easy money",
        "пришли код из смс", "скинь код из смс", "напиши код из смс",
        "код подтверждения", "код верификации", "одноразовый код",
        "переведи деньги", "скинь денег", "займи денег", "дай в долг",
        "на безопасный счет", "на защищенный счет", "на резервный счет",
        "верни деньги", "возврат средств", "компенсация", "выплата",
        "выигрыш", "лотерея", "приз", "наследство", "богатый родственник",
        "работа на дому", "заработок без вложений", "пассивный доход",
        "финансовая пирамида", "млм", "сетевой маркетинг",
        "криптовалюта", "биткоин бесплатно", "майнинг бесплатно",
        "торговый бот", "сигналы для торговли", "гарантированная прибыль",
        "100% прибыль", "без риска", "гарантированный доход",
}

var financialFraudPhrases = []string{
        "скинь номер карты", "пришли данные карты", "номер карты и cvv",
        "три цифры на обороте", "срок действия карты", "пин код карты",
        "логин от банка", "пароль от банка", "доступ к онлайн банку",
        "код из push уведомления", "код из приложения банка",
        "переведи на этот номер", "переведи на эту карту", "переведи на счет",
        "qiwi кошелек", "юмани", "webmoney", "криптокошелек",
        "сбп перевод", "быстрый перевод", "мгновенный перевод",
        "денежный перевод western union", "денежный перевод contact",
        "купи подарочную карту", "пополни steam", "купи ваучер",
        "оплати через терминал", "положи деньги на номер",
        "привяжи карту", "подтверди карту", "верифицируй карту",
        "temporary card", "virtual card", "prepaid card",
}

var phishingDomains = []string{
        "discord-nitro", "discordgift", "steamcommunlty", "steampowerd",
        "free-nitro", "discord-app", "dlscord", "nemaks-free", "nemaks-gift",
        "bit.ly", "tinyurl", "t.co", "goo.gl",
}

var suspiciousPatterns = []string{
        `(?i)(бесплатн|free).{0,20}(coin|монет|gem|нитро|nitro)`,
        `(?i)(нажми|click|перейди|follow).{0,15}(сюда|here|ссылк|link)`,
        `(?i)(выигра|win|получи|get).{0,15}(бесплатно|free|приз|prize)`,
        `(?i)(взлом|hack|украден|stolen).{0,20}(аккаунт|account)`,
        `(?i)(срочн|urgent|немедленн|immediate).{0,20}(действ|action|подтверд|verify)`,
        `(?i)(удвоен|double|умнож|multiply).{0,15}(монет|coin|крипт|crypto)`,
        `(?i)(я из|я сотрудник|я представляю).{0,30}(фсб|полиц|прокуратур|следств|мвд|банк)`,
        `(?i)(против вас|на вас).{0,20}(возбужден|заведен|открыт).{0,20}(дело|производство)`,
        `(?i)(переведи|скинь|отправь).{0,20}(деньги|денег|на карту|на счет)`,
        `(?i)(код из смс|код подтверждения|одноразовый код|sms code|(^|[^a-zа-яё0-9_])otp([^a-zа-яё0-9_]|$))`,
        `(?i)(номер карты|cvv|cvc|пин.?код|pin.?code).{0,30}(пришли|скинь|напиши|отправь)`,
        `(?i)(безопасный счет|защищенный счет|резервный счет|secure account)`,
        `(?i)(ваш родственник|ваш сын|ваша дочь|ваш муж|ваша жена).{0,30}(задержан|в больниц|попал|нужны деньги)`,
        `(?i)(не говорите никому|это секретно|конфиденциально|не кладите трубку)`,
        `(?i)(100.?%.?прибыль|гарантированн.{0,10}доход|без.?риска|легкие деньги)`,
        `(?i)(ф[5s]б|п[0o]л[i1]ц[i1]|м[вb][дd])`,
}

var leetSpeakPatterns = []string{
        `(?i)ф[5s][бb]`,
        `(?i)п[0o]л[i1]ц[i1][яa]`,
        `(?i)м[вb][дd]`,
        `(?i)пр[0o]кур[а@]тур[а@]`,
        `(?i)сл[еe]д[0o]в[а@]т[еe]ль`,
        `(?i)к[а@]рт[а@]`,
        `(?i)п[еe]р[еe]в[0o]д`,
        `(?i)к[0o]д.{0,5}[сs]м[сs]`,
        `(?i)cvv|cvc|с[вv][вv]|с[вv]с`,
}

func GetAllAgencyKeywords() []string {
        var all []string
        all = append(all, russianAgencies...)
        all = append(all, internationalAgencies...)
        all = append(all, rankKeywords...)
        return all
}

func GetAllAbbreviations() []string {
        var all []string
        all = append(all, russianAgencyAbbreviations...)
        all = append(all, internationalAgencyAbbreviations...)
        return all
}

func GetImpersonationPhrases() []string {
        return impersonationPhrases
}

func GetScamKeywords() []string {
        return scamKeywords
}

func GetPhishingDomains() []string {
        return phishingDomains
}

func GetSuspiciousPatterns() []string {
        return suspiciousPatterns
}

func GetLeetSpeakPatterns() []string {
        return leetSpeakPatterns
}

func GetFinancialFraudPhrases() []string {
        return financialFraudPhrases
}

func GetAllFraudPatterns() []string {
        var all []string
        all = append(all, suspiciousPatterns...)
        all = append(all, leetSpeakPatterns...)
        return all
}

func GetAllFraudKeywords() []string {
        var all []string
        all = append(all, GetImpersonationPhrases()...)
        all = append(all, GetScamKeywords()...)
        all = append(all, GetFinancialFraudPhrases()...)
        return all
}

func GetAgencyAbbreviationsForRegex() []string {
        var all []string
        all = append(all, russianAgencyAbbreviations...)
        all = append(all, internationalAgencyAbbreviations...)
        return all
}
