import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Unauthorized"},{status:401});const {id}=await params;const row=await db.conversation.findUnique({where:{id},include:{messages:{orderBy:{createdAt:"asc"}}}});return row?Response.json(row):Response.json({error:"Not found"},{status:404});}
