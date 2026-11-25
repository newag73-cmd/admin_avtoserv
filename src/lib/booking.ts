import { z } from "zod";
import { db } from "./db";
import { getBusinessConfig } from "./config";
import { findSlots } from "./slots";
import { notifyBookingCreated } from "./notifier";

export const bookingInputSchema = z.object({ service_id: z.string().min(1), slot: z.string().datetime(), client_name: z.string().min(1).max(100), client_phone: z.string().min(5).max(20), client_email:z.string().email().max(254).nullable().optional(), comment: z.string().max(500).nullable().optional(), session_id: z.string().max(100).nullable().optional(),source:z.enum(["widget","admin"]).optional() });
export async function availableSlots(serviceId: string, dateFrom?: string, dateTo?: string, excludeBookingId?:string) {
  const c = await getBusinessConfig(), now = new Date(Date.now() + c.booking.min_lead_time_min * 60000), horizon = new Date(Date.now() + c.booking.max_horizon_days * 86400000);
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00Z`) : now, to = dateTo ? new Date(`${dateTo}T23:59:59Z`) : horizon;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return [];
  const scanFrom = new Date(from.getTime()-36*3600000), scanTo = new Date(to.getTime()+36*3600000);
  const busy = (await db.booking.findMany({ where: { serviceId,id:excludeBookingId?{not:excludeBookingId}:undefined, status: { in: ["pending", "confirmed"] }, slotStart: { gte: scanFrom, lte: scanTo } }, select: { slotStart: true } })).map(b=>b.slotStart);
  const parts = (d: Date) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone:c.timezone, year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(d); return `${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}-${p.find(x=>x.type==="day")?.value}`; };
  const dayFrom = dateFrom ?? parts(from), dayTo = dateTo ?? parts(to);
  return findSlots(c, serviceId, scanFrom, scanTo, busy, 200).filter(s=>s.start>=now&&s.start<=horizon&&parts(s.start)>=dayFrom&&parts(s.start)<=dayTo).slice(0,8);
}
export async function createBooking(input: unknown) {
  const data = bookingInputSchema.parse(input), c = await getBusinessConfig(), service = c.services.find(s=>s.id===data.service_id);
  if (!service?.active || service.requires_human_quote || service.parallel_capacity<1) throw new Error("Service cannot be booked online");
  const duration=service.duration_min??c.booking.slot_step_min;
  const start = new Date(data.slot), end = new Date(start.getTime()+duration*60000), now=Date.now();
  if (start.getTime()<now+c.booking.min_lead_time_min*60000 || start.getTime()>now+c.booking.max_horizon_days*86400000) throw new Error("Slot is outside the booking window");
  const phone = data.client_phone.replace(/[^+\d]/g, "");
  if(phone.replace(/\D/g,"").length<7)throw new Error("Enter a valid client phone number through the booking form");
  const duplicate = await db.booking.findFirst({ where:{serviceId:service.id,slotStart:start,clientPhone:phone,createdAt:{gte:new Date(now-5*60000)}} });
  if (duplicate) return { booking:duplicate, duplicate:true };
  const scanFrom=new Date(start.getTime()-36*3600000),scanTo=new Date(start.getTime()+36*3600000);
  const busy=(await db.booking.findMany({where:{serviceId:service.id,status:{in:["pending","confirmed"]},slotStart:{gte:scanFrom,lte:scanTo}},select:{slotStart:true}})).map(b=>b.slotStart);
  if (!findSlots(c,service.id,scanFrom,scanTo,busy,200).some(s=>s.start.getTime()===start.getTime())) throw new Error("Slot is unavailable or outside working hours");
  try { const booking=await db.booking.create({data:{serviceId:service.id,slotStart:start,slotEnd:end,clientName:data.client_name.trim(),clientPhone:phone,clientEmail:data.client_email??undefined,comment:data.comment??undefined,sessionId:data.session_id??undefined,source:data.source??"widget"}}); await notifyBookingCreated(booking); return {booking,duplicate:false}; }
  catch { throw new Error("Slot was just taken; choose another time"); }
}
export async function getBooking(input:{booking_id?:string|null;client_phone?:string|null}) {
  const booking=input.booking_id ? await db.booking.findUnique({where:{id:input.booking_id}}) : input.client_phone ? await db.booking.findFirst({where:{clientPhone:input.client_phone.replace(/[^+\d]/g,""),status:{in:["pending","confirmed"]}},orderBy:{slotStart:"desc"}}) : null;
  if (!booking) return null;
  return {id:booking.id,service_id:booking.serviceId,slot_start:booking.slotStart.toISOString(),slot_end:booking.slotEnd.toISOString(),status:booking.status};
}
export async function cancelBooking(input:{booking_id:string;client_phone:string}) {
  const phone=input.client_phone.replace(/[^+\d]/g, ""),booking=await db.booking.findUnique({where:{id:input.booking_id}});
  if(!booking||booking.clientPhone!==phone) throw new Error("Booking not found for the provided contact");
  if(!["pending","confirmed"].includes(booking.status)) throw new Error("Booking cannot be cancelled in its current status");
  return db.booking.update({where:{id:booking.id},data:{status:"cancelled"}});
}
