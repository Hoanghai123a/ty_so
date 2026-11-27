export const QR_CACHE_KEY = "ty_so.qr_cache.v1";
export const QR_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function readQrCache(storage, now = Date.now()) {
  try {
    const cache = JSON.parse((storage ?? globalThis.localStorage)?.getItem(QR_CACHE_KEY));
    return Array.isArray(cache?.links) && Number.isFinite(cache.savedAt)
      ? { links: cache.links, text: typeof cache.text === "string" ? cache.text : "", hasOverride: cache.hasOverride === true, stale: now - cache.savedAt >= QR_CACHE_MAX_AGE }
      : null;
  } catch {
    return null;
  }
}

export function writeQrCache(links, storage, now = Date.now(), metadata = {}) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(QR_CACHE_KEY, JSON.stringify({ links, savedAt: now, ...metadata }));
    return true;
  } catch {
    return false;
  }
}

export function parseQrLinks(text) {
  if (typeof text !== "string") return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*(?:\||\t)\s*(.+)$/)
        || line.match(/^(.+?)\s+(https?:\/\/\S+)$/i);
      if (!match) return null;

      const name = match[1].trim();
      const url = match[2].trim();
      const isLink = /^https?:\/\/\S+$/i.test(url);
      const isWifi = /^WIFI:/i.test(url);
      return name && (isLink || isWifi) ? { name, url } : null;
    })
    .filter(Boolean);
}

export function qrImageUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
}

export function parseWifiDetails(url) {
  if (typeof url !== "string" || !/^WIFI:/i.test(url)) return null;

  const field = (name) => {
    const match = url.match(new RegExp(`(?:^|;)${name}:((?:\\\\.|[^;])*)`, "i"));
    return match?.[1]?.replace(/\\([;:,\\])/g, "$1") || "";
  };

  return { ssid: field("S"), password: field("P") };
}
