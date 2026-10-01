import { subtitleLabelSelector } from "../player/constants";

export const getDutchSubtitleText = (subtitleParent: HTMLElement): string => {
  const clone = subtitleParent.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".translated").forEach((el) => el.remove());
  return clone.innerText.split("\n").join(" ").replace(/\s+/g, " ").trim();
};

/** Strip VTT/TTML-ish cue markup the player may leave in cue.text. */
export const normalizeCueText = (raw: string): string =>
  raw
    .replace(/<\/?c(\.[^>\s]*)?[^>]*>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .split("\n")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export type CueLike = { startTime: number; endTime?: number; text?: string };

export const getCueText = (cue: CueLike | TextTrackCue): string => {
  const withText = cue as { text?: string };
  return typeof withText.text === "string" ? normalizeCueText(withText.text) : "";
};

/** Future cues after the playhead (active cue is handled separately). */
export const getUpcomingCueTextsFromList = (
  cues: ArrayLike<CueLike> | null | undefined,
  currentTime: number,
  limit: number
): string[] => {
  if (!cues?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.startTime <= currentTime) continue;
    const text = getCueText(cue);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
};

export const getUpcomingCueTexts = (
  track: TextTrack,
  currentTime: number,
  limit: number
): string[] => {
  return getUpcomingCueTextsFromList(track.cues, currentTime, limit);
};

export const getActiveCueText = (track: TextTrack): string => {
  const cues = track.activeCues;
  if (!cues || cues.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i] as TextTrackCue & { text?: string };
    if (typeof cue.text === "string" && cue.text.trim()) parts.push(cue.text);
  }
  return normalizeCueText(parts.join(" "));
};

export const isDutchTextTrackInfo = (track: {
  language?: string;
  label?: string;
}): boolean => {
  const lang = (track.language || "").toLowerCase();
  const label = track.label || "";
  if (lang === "nl" || lang.startsWith("nl-") || lang === "dut" || lang === "nld") return true;
  return /nederlands|dutch/i.test(label);
};

export const isDutchTextTrack = (track: TextTrack): boolean => isDutchTextTrackInfo(track);

export const findDutchTextTrack = (video: HTMLVideoElement): TextTrack | null => {
  const tracks = Array.from(video.textTracks);
  const dutch = tracks.find(
    (t) => (t.kind === "subtitles" || t.kind === "captions") && isDutchTextTrack(t)
  );
  if (dutch) return dutch;
  return (
    tracks.find(
      (t) =>
        (t.kind === "subtitles" || t.kind === "captions") &&
        (t.mode === "showing" || t.mode === "hidden") &&
        (t.cues?.length ?? 0) > 0
    ) ?? null
  );
};

export const getSubtitleOverlayElement = (): HTMLElement | null => {
  return document.querySelector(subtitleLabelSelector) as HTMLElement | null;
};
