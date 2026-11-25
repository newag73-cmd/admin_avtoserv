import { NextRequest } from "next/server";
import { z } from "zod";
import { availableSlots, createBooking } from "@/lib/booking";
export async function GET(req: NextRequest) {
  const serviceId=req.nextUrl.searchParams.get("service_id")??"",dateFrom=req.nextUrl.searchParams.get("date")??undefined,dateTo=req.nextUrl.searchParams.get("date_to")??dateFrom;
  if(dateFrom&&!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)||dateTo&&!/^\d{4}-\d{2}-\d{2}$/.test(dateTo))return Response.json({error:"Invalid date"},{status:400});
  const slots=await availableSlots(serviceId,dateFrom,dateTo);return Response.json({slots:slots.map(s=>({start:s.start.toISOString(),end:s.end.toISOString()}))},{headers:{"cache-control":"no-store"}});
}
export async function POST(req: NextRequest) {
  const input=await req.json().catch(()=>null);
  try { const {booking,duplicate}=await createBooking({...input,source:"widget"});return Response.json({booking:{id:booking.id,status:booking.status},confirmation_text:duplicate?"Запись уже создана и ожидает подтверждения.":"Запись создана и ожидает подтверждения администратора."},{status:duplicate?200:201}); }
  catch(e){const message=e instanceof Error?e.message:"Invalid booking";const status=message.includes("Slot")||message.includes("slot")?409:400;return Response.json({error:message},{status});}
}
