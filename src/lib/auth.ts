import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import {createHash} from "node:crypto";
import {readFile,writeFile,rename,mkdir} from "node:fs/promises";
import path from "node:path";
import { db, databaseConfigured } from "@/lib/db";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-secret-change-me-now");
const passwordFile=()=>path.join(process.env.DATA_DIR??path.join(process.cwd(),"data"),"admin-password.hash");
const passwordSetting="admin-password-hash";
async function passwordHash(){
  if(databaseConfigured){try{const row=await db.appSetting.findUnique({where:{key:passwordSetting}});if(row?.value)return row.value;}catch(error){console.error("persistent_admin_password_read_failed",error instanceof Error?error.name:"unknown");}}
  const saved=await readFile(passwordFile(),"utf8").catch(()=>null);return saved?.trim()||process.env.ADMIN_PASSWORD_HASH||bcrypt.hashSync(process.env.ADMIN_PASSWORD??"change-this-password",10);
}
const version=(hash:string)=>createHash("sha256").update(hash).digest("hex");
async function credentialVersion(){return version(await passwordHash()||process.env.ADMIN_PASSWORD||"change-this-password");}
export async function authenticate(username: string, password: string) { return username === (process.env.ADMIN_USERNAME ?? "admin")&&await bcrypt.compare(password,await passwordHash()); }
export async function changeAdminPassword(current:string,next:string){
  if(!await authenticate(process.env.ADMIN_USERNAME??"admin",current))return false;
  const nextHash=await bcrypt.hash(next,12);
  if(databaseConfigured){const previous=await db.appSetting.findUnique({where:{key:passwordSetting}});await db.appSetting.upsert({where:{key:passwordSetting},create:{key:passwordSetting,value:nextHash},update:{value:nextHash,backup:previous?.value??null}});return true;}
  if(process.env.NODE_ENV==="production")throw new Error("Подключите PostgreSQL в настройках хостинга, чтобы новый пароль сохранялся после перезапуска.");
  const file=passwordFile();await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,nextHash,{encoding:"utf8",mode:0o600});await rename(temp,file);return true;
}
export async function makeSession() { return new SignJWT({ admin: true,version:await credentialVersion() }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret()); }
export async function isAdmin(token?: string) { if (!token) return false; try { const payload=(await jwtVerify(token, secret())).payload;return payload.admin === true&&payload.version===await credentialVersion(); } catch { return false; } }
