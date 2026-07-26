const AR = new Intl.DateTimeFormat("ar-EG", {
  dateStyle: "medium",
  timeStyle: "short",
});
const AR_DATE = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

export function fmtDateTime(iso: string) {
  try {
    return AR.format(new Date(iso));
  } catch {
    return iso;
  }
}
export function fmtDate(iso: string) {
  try {
    return AR_DATE.format(new Date(iso));
  } catch {
    return iso;
  }
}
export function fmtRelative(iso: string) {
  const d = new Date(iso).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  const min = 60_000, hr = 3600_000, day = 86_400_000;
  if (abs < hr) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hr), "hour");
  return rtf.format(Math.round(diff / day), "day");
}
export function fmtDay(iso: string) {
  try { return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(iso)); }
  catch { return iso; }
}