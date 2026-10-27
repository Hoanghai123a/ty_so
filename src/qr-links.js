export function parseQrLinks(text) {
  if (typeof text !== "string") return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*(?:\||\t)\s*(https?:\/\/\S+)$/i)
        || line.match(/^(.+?)\s+(https?:\/\/\S+)$/i);
      if (!match) return null;

      const name = match[1].trim();
      const url = match[2].trim();
      return name ? { name, url } : null;
    })
    .filter(Boolean);
}

export function qrImageUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
}
