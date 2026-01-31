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
}

var russianAgencyAbbreviations = []string{
	"фсб", "фсо", "свр", "мвд", "скр", "фнс", "фтс", "фас", "фсин",
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
