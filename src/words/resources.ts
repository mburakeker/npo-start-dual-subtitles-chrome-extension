export type ResourceLink = { name: string; url: string };

const languageCodeToIso3: Record<string, string> = {
  en: "eng",
  fr: "fra",
  de: "deu",
  es: "spa",
  it: "ita",
  pt: "por",
  ru: "rus",
  zh: "zho",
  ja: "jpn",
  ko: "kor",
  ar: "ara",
  hi: "hin",
  tr: "tur",
  pl: "pol",
  sv: "swe",
  da: "dan",
  fi: "fin",
  no: "nor",
  cs: "ces",
  sk: "slk",
  hu: "hun",
  ro: "ron",
  bg: "bul",
  el: "ell",
  th: "tha",
  vi: "vie",
  id: "ind",
  hy: "hye",
  az: "aze",
  ka: "kat",
};

export const getResourceLinksForWord = (word: string, targetLanguage: string): ResourceLink[] => {
  const query = encodeURIComponent(word);
  const targetLangIso3 = languageCodeToIso3[targetLanguage] ?? "eng";

  return [
    { name: "DeepL", url: `https://www.deepl.com/translator#nl/${targetLanguage}/${query}` },
    { name: "Forvo", url: `https://forvo.com/search/${query}/` },
    { name: "Google Images", url: `https://www.google.com/images?q=${query}` },
    { name: "Google Translate", url: `https://translate.google.com/#nl/${targetLanguage}/${query}` },
    {
      name: "Tatoeba",
      url: `https://tatoeba.org/eng/sentences/search?from=nld&to=${targetLangIso3}&query=${query}`,
    },
    { name: "Wiktionary", url: `https://en.m.wiktionary.org/wiki/${query}#Dutch` },
  ];
};
