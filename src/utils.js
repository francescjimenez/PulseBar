export const HIST_LEN = 60;

export function initHist() {
  return new Array(HIST_LEN).fill(0);
}

export function fmtNet(kbps) {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
  return `${kbps.toFixed(0)} KB/s`;
}

export function fmtGB(gb) {
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}

export function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().split("").map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join("");
}
