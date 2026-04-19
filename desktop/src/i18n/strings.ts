// v0.1.4 i18n strings — UI translation table for the desktop app.
//
// v0.1.8: actual translations for all 9 non-EN locales. EN is still
// the source of truth — t() falls through to EN for any missing key,
// and TypeScript enforces that every locale table covers every key
// in EN via the `Translation` type below.
//
// LANGUAGES is duplicated here intentionally — the desktop tsconfig
// only `include`s src/, so it can't import from the Next.js
// lib/i18n module. The two lists must stay in sync (10 codes, same
// labels). Server-side detection still lives in lib/i18n/index.ts.

export type LanguageCode =
  | "en" | "es" | "fr" | "de" | "ja"
  | "zh" | "pt" | "ko" | "hi" | "ar";

export type LanguageEntry = {
  code: LanguageCode;
  label: string;
  native: string;
};

export const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: "en", label: "English",    native: "English"    },
  { code: "es", label: "Spanish",    native: "Español"    },
  { code: "fr", label: "French",     native: "Français"   },
  { code: "de", label: "German",     native: "Deutsch"    },
  { code: "ja", label: "Japanese",   native: "日本語"      },
  { code: "zh", label: "Chinese",    native: "中文"        },
  { code: "pt", label: "Portuguese", native: "Português"  },
  { code: "ko", label: "Korean",     native: "한국어"      },
  { code: "hi", label: "Hindi",      native: "हिन्दी"       },
  { code: "ar", label: "Arabic",     native: "العربية"     },
];

export const EN = {
  // Top-level nav / sections
  chat: "Chat",
  plan: "Plan",
  usage: "Usage",
  keys: "Keys",
  notes: "Notes",
  memory: "Memory",
  integrations: "Integrations",
  preferences: "Preferences",
  settings: "Settings",
  updates: "Updates",
  billing: "Billing",
  account: "Account",

  // Auth
  signIn: "Sign in",
  signOut: "Sign out",
  signUp: "Sign up",
  email: "Email",
  password: "Password",

  // Common actions
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  copy: "Copy",
  send: "Send",
  retry: "Retry",
  close: "Close",
  open: "Open",
  loading: "Loading…",

  // Chat surface
  newChat: "New chat",
  typeMessage: "Type a message",
  speak: "Speak",
  stop: "Stop",
} as const;

export type StringKey = keyof typeof EN;

// Translation type — every locale table must have a string for every
// EN key. Values are plain `string` (not literal types) so the
// translations can be free-form.
export type Translation = { readonly [K in StringKey]: string };

// es — Spanish (castellano, neutral).
export const ES: Translation = {
  chat: "Chat",
  plan: "Plan",
  usage: "Uso",
  keys: "Claves",
  notes: "Notas",
  memory: "Memoria",
  integrations: "Integraciones",
  preferences: "Preferencias",
  settings: "Ajustes",
  updates: "Actualizaciones",
  billing: "Facturación",
  account: "Cuenta",

  signIn: "Iniciar sesión",
  signOut: "Cerrar sesión",
  signUp: "Crear cuenta",
  email: "Correo electrónico",
  password: "Contraseña",

  save: "Guardar",
  cancel: "Cancelar",
  delete: "Eliminar",
  copy: "Copiar",
  send: "Enviar",
  retry: "Reintentar",
  close: "Cerrar",
  open: "Abrir",
  loading: "Cargando…",

  newChat: "Nuevo chat",
  typeMessage: "Escribe un mensaje",
  speak: "Hablar",
  stop: "Detener",
};

// fr — French (hexagonal).
export const FR: Translation = {
  chat: "Discussion",
  plan: "Forfait",
  usage: "Utilisation",
  keys: "Clés",
  notes: "Notes",
  memory: "Mémoire",
  integrations: "Intégrations",
  preferences: "Préférences",
  settings: "Paramètres",
  updates: "Mises à jour",
  billing: "Facturation",
  account: "Compte",

  signIn: "Se connecter",
  signOut: "Se déconnecter",
  signUp: "S’inscrire",
  email: "E-mail",
  password: "Mot de passe",

  save: "Enregistrer",
  cancel: "Annuler",
  delete: "Supprimer",
  copy: "Copier",
  send: "Envoyer",
  retry: "Réessayer",
  close: "Fermer",
  open: "Ouvrir",
  loading: "Chargement…",

  newChat: "Nouvelle discussion",
  typeMessage: "Écrivez un message",
  speak: "Parler",
  stop: "Arrêter",
};

// de — Standard German.
export const DE: Translation = {
  chat: "Chat",
  plan: "Tarif",
  usage: "Nutzung",
  keys: "Schlüssel",
  notes: "Notizen",
  memory: "Speicher",
  integrations: "Integrationen",
  preferences: "Einstellungen",
  settings: "Einstellungen",
  updates: "Updates",
  billing: "Abrechnung",
  account: "Konto",

  signIn: "Anmelden",
  signOut: "Abmelden",
  signUp: "Registrieren",
  email: "E-Mail",
  password: "Passwort",

  save: "Speichern",
  cancel: "Abbrechen",
  delete: "Löschen",
  copy: "Kopieren",
  send: "Senden",
  retry: "Erneut versuchen",
  close: "Schließen",
  open: "Öffnen",
  loading: "Lädt…",

  newChat: "Neuer Chat",
  typeMessage: "Nachricht eingeben",
  speak: "Sprechen",
  stop: "Stopp",
};

// ja — Japanese (polite form, です/ます).
export const JA: Translation = {
  chat: "チャット",
  plan: "プラン",
  usage: "使用状況",
  keys: "キー",
  notes: "ノート",
  memory: "メモリ",
  integrations: "連携",
  preferences: "環境設定",
  settings: "設定",
  updates: "アップデート",
  billing: "お支払い",
  account: "アカウント",

  signIn: "サインイン",
  signOut: "サインアウト",
  signUp: "サインアップ",
  email: "メールアドレス",
  password: "パスワード",

  save: "保存",
  cancel: "キャンセル",
  delete: "削除",
  copy: "コピー",
  send: "送信",
  retry: "再試行",
  close: "閉じる",
  open: "開く",
  loading: "読み込み中…",

  newChat: "新しいチャット",
  typeMessage: "メッセージを入力",
  speak: "話す",
  stop: "停止",
};

// zh — Chinese (Simplified).
export const ZH: Translation = {
  chat: "聊天",
  plan: "套餐",
  usage: "用量",
  keys: "密钥",
  notes: "笔记",
  memory: "记忆",
  integrations: "集成",
  preferences: "偏好设置",
  settings: "设置",
  updates: "更新",
  billing: "账单",
  account: "账户",

  signIn: "登录",
  signOut: "退出登录",
  signUp: "注册",
  email: "邮箱",
  password: "密码",

  save: "保存",
  cancel: "取消",
  delete: "删除",
  copy: "复制",
  send: "发送",
  retry: "重试",
  close: "关闭",
  open: "打开",
  loading: "加载中…",

  newChat: "新建聊天",
  typeMessage: "输入消息",
  speak: "语音",
  stop: "停止",
};

// pt — Portuguese (Brazilian).
export const PT: Translation = {
  chat: "Chat",
  plan: "Plano",
  usage: "Uso",
  keys: "Chaves",
  notes: "Notas",
  memory: "Memória",
  integrations: "Integrações",
  preferences: "Preferências",
  settings: "Configurações",
  updates: "Atualizações",
  billing: "Cobrança",
  account: "Conta",

  signIn: "Entrar",
  signOut: "Sair",
  signUp: "Criar conta",
  email: "E-mail",
  password: "Senha",

  save: "Salvar",
  cancel: "Cancelar",
  delete: "Excluir",
  copy: "Copiar",
  send: "Enviar",
  retry: "Tentar novamente",
  close: "Fechar",
  open: "Abrir",
  loading: "Carregando…",

  newChat: "Novo chat",
  typeMessage: "Digite uma mensagem",
  speak: "Falar",
  stop: "Parar",
};

// ko — Korean (polite form, 입니다).
export const KO: Translation = {
  chat: "채팅",
  plan: "요금제",
  usage: "사용량",
  keys: "키",
  notes: "노트",
  memory: "메모리",
  integrations: "통합",
  preferences: "환경설정",
  settings: "설정",
  updates: "업데이트",
  billing: "결제",
  account: "계정",

  signIn: "로그인",
  signOut: "로그아웃",
  signUp: "회원가입",
  email: "이메일",
  password: "비밀번호",

  save: "저장",
  cancel: "취소",
  delete: "삭제",
  copy: "복사",
  send: "보내기",
  retry: "다시 시도",
  close: "닫기",
  open: "열기",
  loading: "불러오는 중…",

  newChat: "새 채팅",
  typeMessage: "메시지를 입력하세요",
  speak: "말하기",
  stop: "중지",
};

// hi — Hindi (Devanagari).
export const HI: Translation = {
  chat: "चैट",
  plan: "प्लान",
  usage: "उपयोग",
  keys: "कुंजियाँ",
  notes: "नोट्स",
  memory: "मेमोरी",
  integrations: "एकीकरण",
  preferences: "प्राथमिकताएँ",
  settings: "सेटिंग्स",
  updates: "अपडेट",
  billing: "बिलिंग",
  account: "खाता",

  signIn: "साइन इन करें",
  signOut: "साइन आउट करें",
  signUp: "साइन अप करें",
  email: "ईमेल",
  password: "पासवर्ड",

  save: "सहेजें",
  cancel: "रद्द करें",
  delete: "हटाएँ",
  copy: "कॉपी करें",
  send: "भेजें",
  retry: "पुनः प्रयास करें",
  close: "बंद करें",
  open: "खोलें",
  loading: "लोड हो रहा है…",

  newChat: "नई चैट",
  typeMessage: "संदेश लिखें",
  speak: "बोलें",
  stop: "रोकें",
};

// ar — Arabic (Modern Standard Arabic). RTL handled at the document
// level via PreferencesProvider — strings here are written naturally
// and the layout flips around them.
export const AR: Translation = {
  chat: "محادثة",
  plan: "الخطة",
  usage: "الاستخدام",
  keys: "المفاتيح",
  notes: "الملاحظات",
  memory: "الذاكرة",
  integrations: "التكاملات",
  preferences: "التفضيلات",
  settings: "الإعدادات",
  updates: "التحديثات",
  billing: "الفوترة",
  account: "الحساب",

  signIn: "تسجيل الدخول",
  signOut: "تسجيل الخروج",
  signUp: "إنشاء حساب",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",

  save: "حفظ",
  cancel: "إلغاء",
  delete: "حذف",
  copy: "نسخ",
  send: "إرسال",
  retry: "إعادة المحاولة",
  close: "إغلاق",
  open: "فتح",
  loading: "جارٍ التحميل…",

  newChat: "محادثة جديدة",
  typeMessage: "اكتب رسالة",
  speak: "تحدث",
  stop: "إيقاف",
};

export const STRINGS = {
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  ja: JA,
  zh: ZH,
  pt: PT,
  ko: KO,
  hi: HI,
  ar: AR,
} as const;

export type LocaleCode = keyof typeof STRINGS;

// t — tiny lookup helper. Falls back through:
//   requested locale -> EN -> the key itself
// so a missing translation never crashes the UI.
export function t(locale: string, key: StringKey): string {
  const table = (STRINGS as Record<string, Translation>)[locale] ?? EN;
  return table[key] ?? EN[key] ?? key;
}
