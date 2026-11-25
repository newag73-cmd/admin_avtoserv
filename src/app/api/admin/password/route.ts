import {NextRequest} from "next/server";
import {cookies} from "next/headers";
import {z} from "zod";
import {changeAdminPassword,isAdmin} from "@/lib/auth";
import {sameOriginMutation} from "@/lib/csrf";

const schema=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(12).max(128)});
export async function POST(req:NextRequest){
  if(!sameOriginMutation(req))return Response.json({error:"Запрос с другого сайта запрещён"},{status:403});
  if(!await isAdmin((await cookies()).get("admin_session")?.value))return Response.json({error:"Требуется вход в админку"},{status:401});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:"Новый пароль должен содержать от 12 до 128 символов"},{status:400});
  if(parsed.data.currentPassword===parsed.data.newPassword)return Response.json({error:"Новый пароль должен отличаться от текущего"},{status:400});
  try {
    if(!await changeAdminPassword(parsed.data.currentPassword,parsed.data.newPassword))return Response.json({error:"Текущий пароль неверен"},{status:400});
  } catch(error) {
    console.error("admin_password_save_failed",error instanceof Error ? error.name : "unknown");
    return Response.json({error:"Не удалось сохранить пароль. Проверьте доступ к папке данных."},{status:500});
  }
  (await cookies()).delete("admin_session");
  return Response.json({ok:true,message:"Пароль изменён. Войдите заново."});
}
