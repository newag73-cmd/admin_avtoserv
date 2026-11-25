import { z } from "zod";
import { db } from "./db";
import { getBusinessConfig, fallbackMessage } from "./config";
import { availableSlots, cancelBooking, createBooking, getBooking } from "./booking";
import type { ToolDefinition } from "./llm";

const noExtra=(properties:Record<string,unknown>,required:string[])=>({type:"object",properties,required,additionalProperties:false});
export const toolDefinitions:ToolDefinition[]=[
  {type:"function",function:{name:"get_business_info",description:"Return exact configured business facts from the requested section.",strict:true,parameters:noExtra({section:{type:"string",enum:["services","hours","address","contacts","payment","all"]}},["section"])}},
  {type:"function",function:{name:"find_slots",description:"Find up to eight bookable slots for an active service within a date range.",strict:true,parameters:noExtra({service_id:{type:"string"},date_from:{type:"string",format:"date"},date_to:{type:["string","null"],format:"date"}},["service_id","date_from","date_to"])}},
  {type:"function",function:{name:"create_booking",description:"Create a pending booking after the visitor has confirmed the service and slot. Client details must come from the booking form.",strict:true,parameters:noExtra({service_id:{type:"string"},slot:{type:"string"},client_name:{type:"string"},client_phone:{type:"string"},comment:{type:["string","null"]}},["service_id","slot","client_name","client_phone","comment"])}},
  {type:"function",function:{name:"get_booking",description:"Look up a booking by booking id or client phone.",strict:true,parameters:noExtra({booking_id:{type:["string","null"]},client_phone:{type:["string","null"]}},["booking_id","client_phone"])}},
  {type:"function",function:{name:"cancel_booking",description:"Cancel a pending or confirmed booking after checking its client phone.",strict:true,parameters:noExtra({booking_id:{type:"string"},client_phone:{type:"string"}},["booking_id","client_phone"])}},
  {type:"function",function:{name:"escalate",description:"Create a human follow-up for missing information, complaints or customer request. Do not use for unrelated out-of-scope questions.",strict:true,parameters:noExtra({reason:{type:"string",enum:["out_of_scope","no_data","client_request","complaint"]},summary:{type:"string"}},["reason","summary"])}}
];

const argsByTool={
  get_business_info:z.object({section:z.enum(["services","hours","address","contacts","payment","all"])}),
  find_slots:z.object({service_id:z.string().min(1),date_from:z.string().date(),date_to:z.string().date().nullable()}),
  create_booking:z.object({service_id:z.string().min(1),slot:z.string().datetime(),client_name:z.string().min(1).max(100),client_phone:z.string().min(5).max(20),comment:z.string().max(500).nullable()}),
  get_booking:z.object({booking_id:z.string().nullable(),client_phone:z.string().nullable()}).refine(x=>Boolean(x.booking_id||x.client_phone)),
  cancel_booking:z.object({booking_id:z.string().min(1),client_phone:z.string().min(5).max(20)}),
  escalate:z.object({reason:z.enum(["out_of_scope","no_data","client_request","complaint"]),summary:z.string().min(1).max(500)})
};
const maskPhone=(s:string)=>s.replace(/(?:\+?\d[\s().-]*){10,15}/g,v=>`${"*".repeat(Math.max(0,v.replace(/\D/g,"").length-4))}${v.replace(/\D/g,"").slice(-4)}`);
export async function executeTool(name:string,raw:string){
  let json:unknown;try{json=JSON.parse(raw)}catch{throw new Error("Tool arguments are not valid JSON")}
  if(!(name in argsByTool))throw new Error("Unknown tool");
  const schema=argsByTool[name as keyof typeof argsByTool],parsed=schema.safeParse(json);if(!parsed.success)throw new Error("Tool arguments failed validation");
  const a=parsed.data as any;
  switch(name){
    case "get_business_info":{
      const c=await getBusinessConfig();if(a.section==="all")return {business:c.business,hours:c.hours,payment:c.payment,services:c.services,timezone:c.timezone,booking:c.booking};
      if(a.section==="services")return c.services;
      if(a.section==="hours")return {timezone:c.timezone,hours:c.hours};if(a.section==="address")return {address:c.business.address,map_url:(c.business as any).map_url,parking_note:(c.business as any).parking_note};
      if(a.section==="contacts")return {phone:c.business.phone,whatsapp:(c.business as any).whatsapp,telegram:(c.business as any).telegram,email:c.business.email};return {payment:c.payment};
    }
    case "find_slots":return {slots:(await availableSlots(a.service_id,a.date_from,a.date_to??undefined)).map(s=>({start:s.start.toISOString(),end:s.end.toISOString()})),working_days_note:"Время отображается в часовом поясе бизнеса."};
    case "create_booking":{const result=await createBooking({...a,session_id:null});return {booking_id:result.booking.id,status:result.booking.status,confirmation_text:result.duplicate?"Запись уже существует.":"Запись создана и ожидает подтверждения администратора."};}
    case "get_booking":return await getBooking(a);
    case "cancel_booking":{const b=await cancelBooking(a);return {booking_id:b.id,status:b.status};}
    case "escalate":{
      if(a.reason==="out_of_scope")return {text:"Я отвечаю на вопросы по работе этого бизнеса. Подскажите, чем помочь по услугам или записи?",lead_created:false};
      const c=await getBusinessConfig();await db.lead.create({data:{reason:a.reason,summary:maskPhone(a.summary).slice(0,500)}});
      return {text:fallbackMessage(c),lead_created:true};
    }
    default:throw new Error("Unknown tool");
  }
}
