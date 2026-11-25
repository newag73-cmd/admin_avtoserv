import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db, databaseConfigured } from "@/lib/db";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.union([z.literal("closed"), z.object({ open: time, close: time })]);
const service = z.object({ id: z.string().min(1), name: z.string().min(1), aliases: z.array(z.string()).default([]), duration_min: z.number().positive().nullable(), price: z.number().nonnegative().nullable(), price_note: z.string().nullable().optional(), description: z.string().optional(), parallel_capacity: z.number().int().nonnegative().default(1), active: z.boolean(), requires_human_quote: z.boolean().optional() });
export const businessSchema = z.object({
  schema_version: z.number(), niche: z.string(), ui: z.object({ locale: z.string(), currency: z.string() }), timezone: z.string(),
  business: z.object({ name: z.string(), phone: z.string().optional(), whatsapp: z.string().optional(), telegram: z.string().optional(), email: z.string().optional(), address: z.string().optional() }).passthrough(),
  hours: z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }), payment: z.array(z.string()), services: z.array(service),
  booking: z.object({ min_lead_time_min: z.number().default(60), max_horizon_days: z.number().default(30), slot_step_min: z.number().positive().default(30), reminder_hours_before: z.number().default(24), ask_comment: z.boolean().default(false) }),
  blocked_slots: z.array(z.object({ date: z.string().nullable(), weekday: z.string(), start: time, end: time, reason: z.string() })).default([]),
  notifications: z.object({ client_email: z.boolean().default(true), admin_email: z.string().email().or(z.literal("")).optional(), admin_telegram: z.boolean().default(false) }).default({ client_email:true,admin_telegram:false }),
  assistant_settings: z.object({ model:z.string().min(1).nullable().default(null),temperature:z.number().min(0).max(2).default(0.2),max_tokens:z.number().int().min(1).max(4000).default(600),widget_enabled:z.boolean().default(true),escalation_only:z.boolean().default(false),context_messages:z.number().int().min(1).max(20).default(20) }).default({model:null,temperature:0.2,max_tokens:600,widget_enabled:true,escalation_only:false,context_messages:20}),
  escalation: z.object({ fallback_message: z.string(), always_human: z.array(z.string()).default([]) }),
  widget: z.object({ title: z.string(), button_label: z.string(), avatar_url: z.string(), accent_color: z.string(), position:z.enum(["top-left","top-right","bottom-left","bottom-right"]).default("bottom-right"),greeting: z.string(), quick_replies: z.array(z.string()).max(4) })
}).passthrough().superRefine((c, ctx) => {
  if (![c.business.phone, c.business.whatsapp, c.business.telegram, c.business.email].some(Boolean)) ctx.addIssue({ code: "custom", message: "Укажите хотя бы один контакт", path: ["business"] });
  try { new Intl.DateTimeFormat("en", { timeZone: c.timezone }); } catch { ctx.addIssue({ code: "custom", message: "Некорректный часовой пояс IANA", path: ["timezone"] }); }
  for (const [key, value] of Object.entries(c.hours)) if (value !== "closed" && value.open >= value.close) ctx.addIssue({ code: "custom", message: "Время открытия должно быть раньше закрытия", path: ["hours", key] });
  if (new Set(c.services.map(s => s.id)).size !== c.services.length) ctx.addIssue({ code: "custom", message: "ID услуг должны быть уникальны", path: ["services"] });
});
export type BusinessConfig = z.infer<typeof businessSchema>;
const dataPath = (file: string) => process.env.DATA_DIR ? path.join(process.env.DATA_DIR, file) : path.join(process.cwd(), "data", file);
const settingKeys = { business: "business-config", prompt: "system-prompt" } as const;
async function readStoredSetting(key: string, file: string): Promise<string | null> {
  if (!databaseConfigured) return null;
  try {
    const existing = await db.appSetting.findUnique({ where: { key } });
    if (existing) return existing.value;
    const value = await readFile(dataPath(file), "utf8");
    return (await db.appSetting.upsert({ where: { key }, create: { key, value }, update: {} })).value;
  } catch (error) {
    console.error("persistent_business_setting_read_failed", key, error instanceof Error ? error.name : "unknown");
    return null;
  }
}
async function writeStoredSetting(key: string, value: string, file: string): Promise<void> {
  if (databaseConfigured) {
    const previous = await db.appSetting.findUnique({ where: { key } });
    await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value, backup: previous?.value ?? null } });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Подключите PostgreSQL в настройках хостинга, чтобы изменения сохранялись после перезапуска.");
  const target = dataPath(file), old = await readFile(target, "utf8").catch(() => null);
  if (old) await writeFile(`${target}.bak`, old, "utf8");
  const temp = `${target}.${Date.now()}.tmp`;
  await writeFile(temp, value, "utf8");
  await rename(temp, target);
}
export async function getBusinessConfig(): Promise<BusinessConfig> {
  const raw = await readStoredSetting(settingKeys.business, "business.json") ?? await readFile(dataPath("business.json"), "utf8");
  return businessSchema.parse(JSON.parse(raw));
}
export async function getSystemPrompt(): Promise<string> {
  return await readStoredSetting(settingKeys.prompt, "system-prompt.txt") ?? await readFile(dataPath("system-prompt.txt"), "utf8");
}
export async function getDefaultSystemPrompt(): Promise<string> { return readFile(dataPath("system-prompt.default.txt"), "utf8"); }
export async function saveBusinessConfig(input: unknown): Promise<BusinessConfig> {
  const parsed = businessSchema.parse(input);
  await writeStoredSetting(settingKeys.business, `${JSON.stringify(parsed, null, 2)}\n`, "business.json");
  return parsed;
}
export async function saveSystemPrompt(value: string): Promise<void> { if (value.length > 30000) throw new Error("Промпт превышает 30000 символов"); await writeStoredSetting(settingKeys.prompt, value, "system-prompt.txt"); }
export async function restoreBusinessBackup():Promise<BusinessConfig>{
  if (databaseConfigured) {
    const row = await db.appSetting.findUnique({ where: { key: settingKeys.business } });
    if (!row?.backup) throw new Error("Резервная копия конфигурации не найдена");
    const parsed = businessSchema.parse(JSON.parse(row.backup));
    await writeStoredSetting(settingKeys.business, `${JSON.stringify(parsed, null, 2)}\n`, "business.json");
    return parsed;
  }
  const raw=await readFile(`${dataPath("business.json")}.bak`,"utf8"),parsed=businessSchema.parse(JSON.parse(raw));return saveBusinessConfig(parsed);
}
export async function restoreDefaultPrompt():Promise<void>{await saveSystemPrompt(await getDefaultSystemPrompt());}
export function fallbackMessage(c: BusinessConfig): string { return c.escalation.fallback_message.replaceAll("{phone}", c.business.phone ?? "").replaceAll("{whatsapp}", c.business.whatsapp ?? "").replaceAll("{email}", c.business.email ?? ""); }
