import type { Config } from "../types.ts";

export const EDITION = "en-tafisr-ibn-kathir";

// Part of the cache key — bump when buildSections' output shape or content changes.
export const CACHE_VERSION = 1;

export const CDNS: ((s: number) => string)[] = [
  (s) => `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${EDITION}/${s}.json`,
  (s) => `https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/${EDITION}/${s}.json`,
];

export const tafsirLink = (surah: number, ayah: number | null) =>
  `https://www.alim.org/quran/tafsir/ibn-kathir/surah/${surah}/${ayah}/`;

export const SURAH_NAMES = [
  "Al-Fatihah",
  "Al-Baqarah",
  "Aal-'Imran",
  "An-Nisa",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  "Al-Anfal",
  "At-Tawbah",
  "Yunus",
  "Hud",
  "Yusuf",
  "Ar-Ra'd",
  "Ibrahim",
  "Al-Hijr",
  "An-Nahl",
  "Al-Isra",
  "Al-Kahf",
  "Maryam",
  "Ta-Ha",
  "Al-Anbiya",
  "Al-Hajj",
  "Al-Mu'minun",
  "An-Nur",
  "Al-Furqan",
  "Ash-Shu'ara",
  "An-Naml",
  "Al-Qasas",
  "Al-'Ankabut",
  "Ar-Rum",
  "Luqman",
  "As-Sajdah",
  "Al-Ahzab",
  "Saba",
  "Fatir",
  "Ya-Sin",
  "As-Saffat",
  "Sad",
  "Az-Zumar",
  "Ghafir",
  "Fussilat",
  "Ash-Shura",
  "Az-Zukhruf",
  "Ad-Dukhan",
  "Al-Jathiyah",
  "Al-Ahqaf",
  "Muhammad",
  "Al-Fath",
  "Al-Hujurat",
  "Qaf",
  "Adh-Dhariyat",
  "At-Tur",
  "An-Najm",
  "Al-Qamar",
  "Ar-Rahman",
  "Al-Waqi'ah",
  "Al-Hadid",
  "Al-Mujadila",
  "Al-Hashr",
  "Al-Mumtahanah",
  "As-Saff",
  "Al-Jumu'ah",
  "Al-Munafiqun",
  "At-Taghabun",
  "At-Talaq",
  "At-Tahrim",
  "Al-Mulk",
  "Al-Qalam",
  "Al-Haqqah",
  "Al-Ma'arij",
  "Nuh",
  "Al-Jinn",
  "Al-Muzzammil",
  "Al-Muddaththir",
  "Al-Qiyamah",
  "Al-Insan",
  "Al-Mursalat",
  "An-Naba",
  "An-Nazi'at",
  "'Abasa",
  "At-Takwir",
  "Al-Infitar",
  "Al-Mutaffifin",
  "Al-Inshiqaq",
  "Al-Buruj",
  "At-Tariq",
  "Al-A'la",
  "Al-Ghashiyah",
  "Al-Fajr",
  "Al-Balad",
  "Ash-Shams",
  "Al-Layl",
  "Ad-Duha",
  "Ash-Sharh",
  "At-Tin",
  "Al-'Alaq",
  "Al-Qadr",
  "Al-Bayyinah",
  "Az-Zalzalah",
  "Al-'Adiyat",
  "Al-Qari'ah",
  "At-Takathur",
  "Al-'Asr",
  "Al-Humazah",
  "Al-Fil",
  "Quraysh",
  "Al-Ma'un",
  "Al-Kawthar",
  "Al-Kafirun",
  "An-Nasr",
  "Al-Masad",
  "Al-Ikhlas",
  "Al-Falaq",
  "An-Nas",
];

export const surahName = (n: number) => SURAH_NAMES[n - 1] || `Surah ${n}`;

// Muted "illuminated manuscript" jewel tones.
export const COLORS = [
  "#c9a24b",
  "#3fae93",
  "#5b8fb0",
  "#bb7a64",
  "#9d7bb0",
  "#5fa88f",
  "#b58a4c",
  "#7fa9c2",
  "#c98f5a",
  "#8fae6b",
];

export const READING_WPM = 60;

export const WORD_BUDGET = { MIN: 500, MAX: 14000 };

export const TOAST_MS = 1600;
export const TOAST_ACTION_MS = 8000; // longer, so there's time to use a toast's action

export const DEFAULT_WEIGHT = 5;

// Words ignored when testing whether a line is a Title-Case heading.
export const SMALL = new Set(
  "of the that for which during with from as not but or a an in on to and is was were are be by his their them they he she it this these those who whom at into upon".split(
    " ",
  ),
);

export const DEFAULT_CONFIG: Config = {
  // Availability tiers. Each week the front of every bucket reads, then rotates
  // to the back on "Mark as sent" — so #readers/week === #buckets.
  buckets: [
    { id: "b1", members: ["Ahmad"] },
    { id: "b2", members: ["Bilal", "Yusuf"] },
    { id: "b3", members: ["Khalid", "Hamza", "Idris", "Anas"] },
  ],
  weights: { Ahmad: 10, Bilal: 7, Yusuf: 6, Khalid: 6, Hamza: 3, Idris: 1, Anas: 2 },
  surah: 3,
  startAyah: 130,
  wordBudget: 3600,
  readingWpm: READING_WPM,
  budgetMin: WORD_BUDGET.MIN,
  budgetMax: WORD_BUDGET.MAX,
  templates: {
    intro:
      "Assalamualaikum everyone,\n\nJazakAllah for joining last Saturday's halaqa — MashAllah, everyone did a great job! If you missed it, please try to record your part.\n\nHere is the reading list for next week ({surah}). Tap your link to read Tafsir Ibn Kathir on Alim.org:",
    outro:
      "Insha'Allah we will meet next Saturday at 10:30am EST. JazakAllah for your participation!",
  },
};
