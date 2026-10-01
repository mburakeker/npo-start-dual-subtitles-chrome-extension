/** Parse Google Translate `client=gtx` JSON into a single string. */
export const parseGoogleTranslateResponse = (data: unknown): string => {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  return (data[0] as unknown[])
    .map((item) => (Array.isArray(item) ? String(item[0] ?? "") : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};
