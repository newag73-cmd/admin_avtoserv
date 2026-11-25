import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cancelBooking } from "@/lib/booking";
import { db } from "@/lib/db";
const key=()=>new TextEncoder().encode(process.env.SESSION_SECRET??"development-only-secret-change-me-now");
export async function POST(req:NextRequest){const data=await req.json().catch(()=>null);if(typeof data?.token!=="string")return Response.json({error:"Invalid cancellation token"},{status:400});try{const {payload}=await jwtVerify(data.token,key());if(payload.purpose!=="cancel"||typeof payload.bookingId!=="string")return Response.json({error:"Invalid cancellation token"},{status:401});const booking=await db.booking.findUnique({where:{id:payload.bookingId}});if(!booking)return Response.json({error:"Booking not found"},{status:404});const cancelled=await cancelBooking({booking_id:booking.id,client_phone:booking.clientPhone});return Response.json({ok:true,status:cancelled.status});}catch(e){return Response.json({error:e instanceof Error?e.message:"Cancellation failed"},{status:400});}}
