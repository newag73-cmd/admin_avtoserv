import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getBusinessConfig } from "@/lib/config";
import { sendReminder } from "@/lib/notifier";
export async function POST(req:NextRequest){const secret=process.env.CRON_SECRET;if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return Response.json({error:"Unauthorized"},{status:401});const c=await getBusinessConfig(),now=new Date(),until=new Date(now.getTime()+c.booking.reminder_hours_before*3600000),rows=await db.booking.findMany({where:{status:"confirmed",reminderSentAt:null,slotStart:{gt:now,lte:until}},take:100});let sent=0;for(const booking of rows){await sendReminder(booking);const result=await db.booking.updateMany({where:{id:booking.id,reminderSentAt:null},data:{reminderSentAt:new Date()}});sent+=result.count;}return Response.json({processed:sent});}
