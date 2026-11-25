import nodemailer from "nodemailer";
import { SignJWT } from "jose";
import type { Booking } from "@prisma/client";
import { getBusinessConfig } from "./config";
import { db } from "./db";

export interface Notifier { email(to:string,subject:string,text:string):Promise<void>; telegram(text:string):Promise<void> }
class SmtpTelegramNotifier implements Notifier {
  async email(to:string,subject:string,text:string){
    if(!to||!process.env.SMTP_HOST||!process.env.SMTP_FROM)return;
    const port=Number(process.env.SMTP_PORT??587),transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
    await transporter.sendMail({from:process.env.SMTP_FROM,to,subject,text});
  }
  async telegram(text:string){
    const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_ADMIN_CHAT_ID;if(!token||!chatId)return;
    const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,text}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("Telegram notification failed");
  }
}
export const notifier:Notifier=new SmtpTelegramNotifier();
const secret=()=>new TextEncoder().encode(process.env.SESSION_SECRET??"development-only-secret-change-me-now");
export async function cancellationUrl(booking:Pick<Booking,"id">){
  const token=await new SignJWT({bookingId:booking.id,purpose:"cancel"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("60d").sign(secret());
  return `${(process.env.APP_BASE_URL??"http://localhost:3000").replace(/\/$/,"")}/booking/cancel?token=${encodeURIComponent(token)}`;
}
const displayTime=async(d:Date)=>{const c=await getBusinessConfig();return new Intl.DateTimeFormat(c.ui.locale,{timeZone:c.timezone,dateStyle:"medium",timeStyle:"short"}).format(d);};
export async function notifyBookingCreated(booking:Booking){
  try{
    const c=await getBusinessConfig(),service=c.services.find(s=>s.id===booking.serviceId),when=await displayTime(booking.slotStart),cancelUrl=await cancellationUrl(booking),details=`${service?.name??booking.serviceId}\n${when}\nСтатус: ожидает подтверждения администратора.`;
    if(c.notifications.client_email&&booking.clientEmail)await notifier.email(booking.clientEmail,`Запись в ${c.business.name}`,`${booking.clientName}, ваша заявка принята.\n\n${details}\n\nОтменить запись: ${cancelUrl}`);
    const adminText=`Новая запись: ${booking.clientName}; ${service?.name??booking.serviceId}; ${when}; статус pending.`;
    if(c.notifications.admin_email)await notifier.email(c.notifications.admin_email,`Новая запись — ${c.business.name}`,adminText);
    if(c.notifications.admin_telegram)await notifier.telegram(adminText);
  }catch(e){console.error("booking notification failed",e instanceof Error?e.message:"unknown");}
}
export async function notifyBookingStatus(bookingId:string){
  try{const booking=await db.booking.findUnique({where:{id:bookingId}});if(!booking)return;const c=await getBusinessConfig(),service=c.services.find(s=>s.id===booking.serviceId),when=await displayTime(booking.slotStart),statusText=booking.status==="confirmed"?"подтверждена":booking.status==="cancelled"?"отменена":booking.status;
    if(booking.clientEmail)await notifier.email(booking.clientEmail,`Статус записи — ${c.business.name}`,`Здравствуйте, ${booking.clientName}. Ваша запись ${service?.name??booking.serviceId} на ${when} ${statusText}.`);
  }catch(e){console.error("booking status notification failed",e instanceof Error?e.message:"unknown");}
}
export async function sendReminder(booking:Booking){
  try{if(!booking.clientEmail)return;const c=await getBusinessConfig(),service=c.services.find(s=>s.id===booking.serviceId),when=await displayTime(booking.slotStart);await notifier.email(booking.clientEmail,`Напоминание о записи — ${c.business.name}`,`Напоминаем о записи ${service?.name??booking.serviceId} на ${when}.`);}catch(e){console.error("booking reminder failed",e instanceof Error?e.message:"unknown");}
}
