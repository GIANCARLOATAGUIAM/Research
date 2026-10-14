// The clinic operates in Philippine time, whatever the server's timezone.
// Asia/Manila has no daylight saving time, so its offset is always +08:00.
const TIME_ZONE = "Asia/Manila";
const OFFSET = "+08:00";

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// "Reyes, Andrea L." style name for lists and headers.
export function studentName(s: {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}) {
  const middle = s.middle_name ? ` ${s.middle_name.trim().charAt(0)}.` : "";
  return `${s.last_name}, ${s.first_name}${middle}`;
}

// A date-only value (YYYY-MM-DD) is a clinic calendar date, not an instant.
function toDate(value: string | Date) {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00${OFFSET}`) : new Date(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toDate(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(value));
}

// "09:00:00" -> "9:00 AM"
export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Today's clinic date as YYYY-MM-DD.
export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

// Start of a clinic day as an ISO timestamp, for range filters.
export function manilaDayStart(date: string) {
  return `${date}T00:00:00${OFFSET}`;
}

// <input type="datetime-local"> value (clinic time) -> ISO timestamp.
export function fromManilaInput(local: string) {
  return `${local.length === 16 ? `${local}:00` : local}${OFFSET}`;
}

// ISO timestamp -> <input type="datetime-local"> value in clinic time.
export function toManilaInput(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function nowManilaInput() {
  return toManilaInput(new Date());
}

const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatWeekdays(isoDays: number[]) {
  return isoDays.map((d) => WEEKDAYS[d]).join(", ");
}
