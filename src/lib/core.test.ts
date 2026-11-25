import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { businessSchema } from "./config";
import { findSlots } from "./slots";
import { buildSystemPrompt } from "./prompt";
import { complete } from "./llm";
import { rateLimited,resetRateLimitsForTests } from "./rate-limit";
import {getBusinessConfig} from "./config";
import os from "node:os";
import path from "node:path";
import {promises as fsp} from "node:fs";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import MessageBody from "../components/MessageBody";
const sample = JSON.parse(fs.readFileSync("data/business.json", "utf8"));
describe("business config", () => {
  it("accepts demo configuration and rejects reversed hours", () => {
    expect(businessSchema.safeParse(sample).success).toBe(true);
    const bad = structuredClone(sample); bad.hours.mon = { open: "20:00", close: "09:00" };
    expect(businessSchema.safeParse(bad).success).toBe(false);
  });
  it("checks time zone and required contact", () => {
    const bad = structuredClone(sample); bad.timezone = "Mars/Olympus";
    expect(businessSchema.safeParse(bad).success).toBe(false);
    bad.timezone = "Europe/Moscow"; bad.business.phone = ""; bad.business.whatsapp = ""; bad.business.telegram = ""; bad.business.email = "";
    expect(businessSchema.safeParse(bad).success).toBe(false);
  });
});
describe("slot generation", () => {
  it("does not offer a slot overlapping lunch or outside working hours", () => {
    const from = new Date("2026-11-07T00:00:00Z"), to = new Date("2026-11-08T20:00:00Z");
    const slots = findSlots(sample, "wheel_balance", from, to);
    expect(slots.every(s => !s.start.toISOString().includes("T10:00:00.000Z"))).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });
  it("returns no slots for inactive or durationless services", () => {
    expect(findSlots(sample, "engine_rebuild", new Date(), new Date(Date.now()+86400000))).toEqual([]);
    expect(findSlots(sample, "body_work", new Date(), new Date(Date.now()+86400000))).toEqual([]);
  });
  it("supports durationless offers using the configured slot step",()=>{const cafe=structuredClone(sample);cafe.services=[{id:"table",name:"Столик",duration_min:null,price:null,parallel_capacity:4,active:true}];const start=new Date("2026-11-07T00:00:00Z"),slots=findSlots(businessSchema.parse(cafe),"table",start,new Date("2026-11-07T23:59:00Z"));expect(slots.length).toBeGreaterThan(0);expect(slots[0].end.getTime()-slots[0].start.getTime()).toBe(cafe.booking.slot_step_min*60000);});
  it("uses the configured timezone to place Saturday opening at 10:00 Moscow time",()=>{const slots=findSlots(sample,"wheel_balance",new Date("2026-11-07T00:00:00Z"),new Date("2026-11-07T23:59:00Z"));expect(slots[0]?.start.toISOString()).toBe("2026-11-07T07:00:00.000Z");});
});
describe("mock assistant",()=>{
  it("answers a configured price and its note",async()=>{
    const prompt=buildSystemPrompt(fs.readFileSync("data/system-prompt.txt","utf8"),businessSchema.parse(sample));
    const answer=await complete([{role:"system",content:prompt},{role:"user",content:"Сколько стоит замена передних тормозных колодок?"}]);
    expect(answer).toContain("2200");expect(answer).toContain("без стоимости запчастей");
  });
  it("matches exact configured aliases for a service",async()=>{const c=structuredClone(sample);c.services.find((s:any)=>s.id==="oil_change").aliases=["поменять масло"];const prompt=buildSystemPrompt(fs.readFileSync("data/system-prompt.txt","utf8"),businessSchema.parse(c));const answer=await complete([{role:"system",content:prompt},{role:"user",content:"Сколько стоит поменять масло?"}]);expect(answer).toContain("1500");});
  it("does not match a service when no token matches",async()=>{const prompt=buildSystemPrompt(fs.readFileSync("data/system-prompt.txt","utf8"),businessSchema.parse(sample));const answer=await complete([{role:"system",content:prompt},{role:"user",content:"Сколько стоит шиномонтаж?"}]);expect(answer).toContain("Точного ответа");expect(answer).not.toContain("1500");});
});
describe("rate limits",()=>{it("allows twenty messages per window and rejects the next",()=>{resetRateLimitsForTests();for(let i=1;i<=20;i++)expect(rateLimited("session",20,60000,1000+i)).toBe(false);expect(rateLimited("session",20,60000,2000)).toBe(true);expect(rateLimited("session",20,60000,62001)).toBe(false);});});
describe("live configuration and universal prompt",()=>{
  it("reads edited config values without restarting",async()=>{const dir=await fsp.mkdtemp(path.join(os.tmpdir(),"biz-config-")),prior=process.env.DATA_DIR;try{const local=structuredClone(sample);await fsp.writeFile(path.join(dir,"business.json"),JSON.stringify(local));process.env.DATA_DIR=dir;expect((await getBusinessConfig()).services[0].price).toBe(1500);local.services[0].price=1777;await fsp.writeFile(path.join(dir,"business.json"),JSON.stringify(local));expect((await getBusinessConfig()).services[0].price).toBe(1777);}finally{if(prior===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=prior;await fsp.rm(dir,{recursive:true,force:true});}});
  it("uses business data for another niche without niche-specific code",()=>{const cafe=structuredClone(sample);cafe.niche="cafe";cafe.business.name="Кофейня Тест";cafe.services=[{id:"latte",name:"Латте",duration_min:null,price:250,price_note:null,parallel_capacity:1,active:true}];const prompt=buildSystemPrompt(fs.readFileSync("data/system-prompt.txt","utf8"),businessSchema.parse(cafe));expect(prompt).toContain("Кофейня Тест");expect(prompt).toContain("Латте");});
});
describe("safe markdown",()=>{it("does not render injected script markup",()=>{const html=renderToStaticMarkup(createElement(MessageBody,{text:"<script>alert(1)</script>\n\n**safe text**"}));expect(html).not.toContain("<script");expect(html).toContain("safe text");});});
