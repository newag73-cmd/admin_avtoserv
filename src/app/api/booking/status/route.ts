import {NextRequest} from "next/server";
import {z} from "zod";
import {db} from "@/lib/db";
import {getBusinessConfig} from "@/lib/config";
const schema=z.object({booking_id:z.string().max(100).optional(),client_phone:z.string().max(20).optional()}).refine(x=>Boolean(x.booking_id||x.client_phone));
export async function POST(req:NextRequest){const input=schema.safeParse(await req.json().catch(()=>null));if(!input.success)return Response.json({error:"Введите номер телефона или идентификатор записи"},{status:400});const phone=input.data.client_phone?.replace(/[^+\d]/g,"");const rows=await db.booking.findMany({where:input.data.booking_id?{id:input.data.booking_id}:{clientPhone:phone},orderBy:{slotStart:"desc"},take:5});if(!rows.length)return Response.json({error:"Запись не найдена"},{status:404});const c=await getBusinessConfig();return Response.json({bookings:rows.map(b=>({id:b.id,service:c.services.find(s=>s.id===b.serviceId)?.name??b.serviceId,slot:new Intl.DateTimeFormat(c.ui.locale,{timeZone:c.timezone,dateStyle:"medium",timeStyle:"short"}).format(b.slotStart),status:b.status}))});}
