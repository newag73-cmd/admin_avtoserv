import type { BusinessConfig } from "./config";
export type Slot = { start: Date; end: Date };
const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
export function findSlots(config: BusinessConfig, serviceId: string, from: Date, to: Date, busy: Date[] = [], limit = 8): Slot[] {
  const service = config.services.find(s => s.id === serviceId);
  if (!service?.active || service.requires_human_quote || service.parallel_capacity < 1) return [];
  const duration=service.duration_min??config.booking.slot_step_min;
  const tz = config.timezone, weekdayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const local = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const offsetAt = (d: Date) => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(d); const z = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT+00:00"; const m = z.match(/GMT([+-])(\d{2}):(\d{2})/); return m ? (m[1] === "+" ? 1 : -1) * (+m[2] * 60 + +m[3]) : 0; };
  const result: Slot[] = [];
  for (let day = new Date(from); day <= to && result.length < limit; day.setUTCDate(day.getUTCDate() + 1)) {
    const parts = local(day), get = (t: string) => parts.find(p => p.type === t)?.value ?? "", date = `${get("year")}-${get("month")}-${get("day")}`;
    const weekday = get("weekday").toLowerCase().slice(0, 3), key = weekday === "sun" ? "sun" : weekdayKey[["sun","mon","tue","wed","thu","fri","sat"].indexOf(weekday)] ?? "mon";
    const hours = config.hours[key as keyof typeof config.hours]; if (hours === "closed") continue;
    const make = (mins: number) => { const wall = new Date(`${date}T${String(Math.floor(mins / 60)).padStart(2,"0")}:${String(mins % 60).padStart(2,"0")}:00Z`); return new Date(wall.getTime() - offsetAt(wall) * 60000); };
    for (let n = hhmm(hours.open); n + duration <= hhmm(hours.close) && result.length < limit; n += config.booking.slot_step_min) {
      const start = make(n), end = make(n + duration);
      if (start < from || start > to || busy.some(b => Math.abs(b.getTime() - start.getTime()) < duration * 60000)) continue;
      const blocked = config.blocked_slots.some(b => (b.date === date || b.weekday === "*" || b.weekday === weekday) && n < hhmm(b.end) && n + duration > hhmm(b.start));
      if (!blocked) result.push({ start, end });
    }
  }
  return result;
}
