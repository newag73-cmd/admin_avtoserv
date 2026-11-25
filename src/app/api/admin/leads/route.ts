import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sameOriginMutation } from "@/lib/csrf";
export async function GET(){if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});return Response.json(await db.lead.findMany({orderBy:{createdAt:"desc"},take:500}));}
export async function PATCH(req:NextRequest){if(!sameOriginMutation(req))return Response.json({error:"Cross-origin request denied"},{status:403});if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});const b=await req.json().catch(()=>null);if(typeof b?.id!=="string"||!["new","in_progress","replied"].includes(b.status))return Response.json({error:"Invalid lead status"},{status:400});return Response.json(await db.lead.update({where:{id:b.id},data:{status:b.status}}));}
