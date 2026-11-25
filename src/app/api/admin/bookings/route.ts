import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { notifyBookingStatus } from "@/lib/notifier";
import { sameOriginMutation } from "@/lib/csrf";
import { availableSlots } from "@/lib/booking";
import { getBusinessConfig } from "@/lib/config";
import { createBooking } from "@/lib/booking";
export async function POST(req:NextRequest){if(!sameOriginMutation(req))return Response.json({error:"Cross-origin request denied"},{status:403});if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});const body=await req.json().catch(()=>null);try{const {booking}=await createBooking({...body,source:"admin",session_id:null});return Response.json(booking,{status:201});}catch(e){return Response.json({error:e instanceof Error?e.message:"Invalid booking"},{status:400});}}
export async function GET() { if (!await isAdmin((await cookies()).get("admin_session")?.value)) return Response.json({ error: "Unauthorized" }, { status: 401 }); return Response.json(await db.booking.findMany({ orderBy: { slotStart: "asc" }, take: 500 })); }
export async function PATCH(req: NextRequest) {
  if(!sameOriginMutation(req))return Response.json({error:"Cross-origin request denied"},{status:403});
  if (!await isAdmin((await cookies()).get("admin_session")?.value)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json().catch(() => null), statuses = ["pending", "confirmed", "completed", "cancelled", "no_show"];
  if(!data||typeof data.id!=="string")return Response.json({error:"Некорректная запись"},{status:400});
  const booking = await db.booking.findUnique({ where: { id: data.id } }); if (!booking) return Response.json({ error: "Запись не найдена" }, { status: 404 });
  if(typeof data.slot_start==="string"){
    const start=new Date(data.slot_start);if(!Number.isFinite(start.getTime()))return Response.json({error:"Некорректное время"},{status:400});
    const c=await getBusinessConfig(),parts=new Intl.DateTimeFormat("en-CA",{timeZone:c.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(start),date=`${parts.find(x=>x.type==="year")?.value}-${parts.find(x=>x.type==="month")?.value}-${parts.find(x=>x.type==="day")?.value}`;
    const allowedSlots=await availableSlots(booking.serviceId,date,date,booking.id);if(!allowedSlots.some(s=>s.start.getTime()===start.getTime()))return Response.json({error:"Выберите свободный слот из рабочего графика"},{status:409});
    const service=c.services.find(s=>s.id===booking.serviceId);if(!service)return Response.json({error:"Услуга больше не настроена"},{status:409});
    try{return Response.json(await db.booking.update({where:{id:booking.id},data:{slotStart:start,slotEnd:new Date(start.getTime()+(service.duration_min??c.booking.slot_step_min)*60000)}}));}catch{return Response.json({error:"Этот слот уже занят"},{status:409});}
  }
  if(!statuses.includes(data.status))return Response.json({error:"Некорректный статус записи"},{status:400});
  const allowed: Record<string, string[]> = { pending: ["confirmed", "cancelled"], confirmed: ["completed", "cancelled", "no_show"], completed: [], cancelled: [], no_show: [] };
  if (!allowed[booking.status]?.includes(data.status)) return Response.json({ error: "Недопустимый переход статуса" }, { status: 409 });
  const updated=await db.booking.update({ where: { id: data.id }, data: { status: data.status } });
  if(["confirmed","cancelled"].includes(data.status))await notifyBookingStatus(updated.id);
  return Response.json(updated);
}
