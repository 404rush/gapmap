/** Link that opens the original page scrolled to (and highlighting) a passage, using URL text fragments. */
export function textFragmentUrl(url: string, passage: string): string {
  const base = url.split("#")[0];
  const words = passage
    .replace(/[•|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return base;
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
  if (words.length <= 10) return `${base}#:~:text=${enc(words.join(" "))}`;
  return `${base}#:~:text=${enc(words.slice(0, 5).join(" "))},${enc(words.slice(-5).join(" "))}`;
}
