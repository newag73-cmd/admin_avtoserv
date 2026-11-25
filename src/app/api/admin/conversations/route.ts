import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sameOriginMutation } from "@/lib/csrf";
export async function GET(){if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});const rows=await db.conversation.findMany({orderBy:{lastAt:"desc"},take:200,include:{_count:{select:{messages:true}},messages:{orderBy:{createdAt:"desc"},take:1,select:{content:true,createdAt:true}}}});return Response.json(rows);}
export async function PATCH(req:NextRequest){if(!sameOriginMutation(req))return Response.json({error:"Cross-origin request denied"},{status:403});if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});const b=await req.json().catch(()=>null);if(typeof b?.id!=="string"||typeof b?.flagged!=="boolean")return Response.json({error:"Invalid update"},{status:400});return Response.json(await db.conversation.update({where:{id:b.id},data:{flagged:b.flagged}}));}
