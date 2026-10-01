import { describe, expect, it } from "vitest";

import {

  getUpcomingCueTextsFromList,

  isDutchTextTrackInfo,

  normalizeCueText,

} from "../cues/text";

import { CueTranslationCache } from "../cues/cache";

import { getResourceLinksForWord } from "../words/resources";

import { formatWiktionaryNlDefinitions } from "../translation/wiktionary";

import { parseGoogleTranslateResponse } from "../translation/google";

import { getReleaseNote, shouldShowWhatsNewBadge } from "../whats-new/notes";



describe("normalizeCueText", () => {

  it("strips VTT color tags and collapses whitespace", () => {

    expect(normalizeCueText("<c.white>Hallo</c>\nwereld")).toBe("Hallo wereld");

  });



  it("strips generic markup", () => {

    expect(normalizeCueText("<b>Goedemorgen</b>")).toBe("Goedemorgen");

  });



  it("trims empty input", () => {

    expect(normalizeCueText("   \n  ")).toBe("");

  });

});



describe("getUpcomingCueTextsFromList", () => {

  const cues = [

    { startTime: 0, text: "eerste" },

    { startTime: 2, text: "tweede" },

    { startTime: 4, text: "derde" },

    { startTime: 6, text: "derde" },

    { startTime: 8, text: "vierde" },

  ];



  it("returns future unique cues up to the limit", () => {

    expect(getUpcomingCueTextsFromList(cues, 1.5, 2)).toEqual(["tweede", "derde"]);

  });



  it("skips past and active start times", () => {

    // startTime <= currentTime is excluded; the duplicate "derde" at t=6 still qualifies.

    expect(getUpcomingCueTextsFromList(cues, 4, 5)).toEqual(["derde", "vierde"]);

  });



  it("returns empty when there are no cues", () => {

    expect(getUpcomingCueTextsFromList(null, 0, 5)).toEqual([]);

  });

});



describe("isDutchTextTrackInfo", () => {

  it("matches nl / dut / nld language codes", () => {

    expect(isDutchTextTrackInfo({ language: "nl" })).toBe(true);

    expect(isDutchTextTrackInfo({ language: "nl-NL" })).toBe(true);

    expect(isDutchTextTrackInfo({ language: "dut" })).toBe(true);

    expect(isDutchTextTrackInfo({ language: "nld" })).toBe(true);

  });



  it("matches Dutch labels", () => {

    expect(isDutchTextTrackInfo({ language: "", label: "Nederlands" })).toBe(true);

    expect(isDutchTextTrackInfo({ language: "en", label: "Dutch" })).toBe(true);

  });



  it("rejects unrelated tracks", () => {

    expect(isDutchTextTrackInfo({ language: "en", label: "English" })).toBe(false);

  });

});



describe("CueTranslationCache", () => {

  it("stores and retrieves translations", () => {

    const cache = new CueTranslationCache(3);

    cache.set("hallo", "hello");

    expect(cache.get("hallo")).toBe("hello");

  });



  it("evicts oldest entries when over max size", () => {

    const cache = new CueTranslationCache(2);

    cache.set("a", "1");

    cache.set("b", "2");

    cache.set("c", "3");

    expect(cache.has("a")).toBe(false);

    expect(cache.get("b")).toBe("2");

    expect(cache.get("c")).toBe("3");

    expect(cache.size).toBe(2);

  });



  it("tracks in-flight prefetch keys", () => {

    const cache = new CueTranslationCache(10);

    cache.markInFlight("x");

    expect(cache.isInFlight("x")).toBe(true);

    cache.clearInFlight("x");

    expect(cache.isInFlight("x")).toBe(false);

  });



  it("clear removes cache and in-flight state", () => {

    const cache = new CueTranslationCache(10);

    cache.set("a", "1");

    cache.markInFlight("b");

    cache.clear();

    expect(cache.size).toBe(0);

    expect(cache.isInFlight("b")).toBe(false);

  });

});



describe("getResourceLinksForWord", () => {

  it("builds expected learning links", () => {

    const links = getResourceLinksForWord("fiets", "en");

    expect(links.map((l) => l.name)).toEqual([

      "DeepL",

      "Forvo",

      "Google Images",

      "Google Translate",

      "Tatoeba",

      "Wiktionary",

    ]);

    expect(links.find((l) => l.name === "Tatoeba")?.url).toContain("to=eng");

    expect(links.find((l) => l.name === "DeepL")?.url).toContain("#nl/en/fiets");

  });



  it("falls back to eng iso3 for unknown languages", () => {

    const links = getResourceLinksForWord("huis", "xx");

    expect(links.find((l) => l.name === "Tatoeba")?.url).toContain("to=eng");

  });

});



describe("parseGoogleTranslateResponse", () => {

  it("joins translation segments", () => {

    expect(parseGoogleTranslateResponse([[["Hello ", "Hallo"], ["world", "wereld"]]])).toBe(

      "Hello world"

    );

  });



  it("returns empty string for invalid payloads", () => {

    expect(parseGoogleTranslateResponse(null)).toBe("");

    expect(parseGoogleTranslateResponse({})).toBe("");

  });

});



describe("formatWiktionaryNlDefinitions", () => {

  it("formats up to three Dutch senses and strips HTML", () => {

    const result = formatWiktionaryNlDefinitions({

      nl: [

        { partOfSpeech: "Noun", definitions: [{ definition: "a <i>bicycle</i>" }] },

        { partOfSpeech: "Verb", definitions: [{ definition: "to cycle" }] },

        { partOfSpeech: "Adjective", definitions: [{ definition: "unused" }] },

        { partOfSpeech: "Extra", definitions: [{ definition: "should not appear" }] },

      ],

    });

    expect(result).toBe("Noun: a bicycle\nVerb: to cycle\nAdjective: unused");

  });



  it("returns null when no Dutch entries exist", () => {

    expect(formatWiktionaryNlDefinitions({ en: [] })).toBeNull();

    expect(formatWiktionaryNlDefinitions(null)).toBeNull();

  });

});



describe("whats-new helpers", () => {

  it("returns a release note for known versions", () => {

    expect(getReleaseNote("0.5.2")?.date).toBe("01-10-2026");

    expect(getReleaseNote("9.9.9")).toBeNull();

  });



  it("shows badge only when unseen and a note exists", () => {

    expect(shouldShowWhatsNewBadge("0.5.2", "0.5.1", true)).toBe(true);

    expect(shouldShowWhatsNewBadge("0.5.2", "0.5.2", true)).toBe(false);

    expect(shouldShowWhatsNewBadge("0.5.2", undefined, false)).toBe(false);

  });

});

