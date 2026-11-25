import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import {createHash} from "node:crypto";
import {readFile,writeFile,rename,mkdir} from "node:fs/promises";
import path from "node:path";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-secret-change-me-now");
const passwordFile=()=>path.join(process.env.DATA_DIR??path.join(process.cwd(),"data"),"admin-password.hash");
async function passwordHash(){const saved=await readFile(passwordFile(),"utf8").catch(()=>null);return saved?.trim()||process.env.ADMIN_PASSWORD_HASH||bcrypt.hashSync(process.env.ADMIN_PASSWORD??"change-this-password",10);}
const version=(hash:string)=>createHash("sha256").update(hash).digest("hex");
async function credentialVersion(){const saved=await readFile(passwordFile(),"utf8").catch(()=>null);return version(saved?.trim()||process.env.ADMIN_PASSWORD_HASH||process.env.ADMIN_PASSWORD||"change-this-password");}
export async function authenticate(username: string, password: string) { return username === (process.env.ADMIN_USERNAME ?? "admin")&&await bcrypt.compare(password,await passwordHash()); }
export async function changeAdminPassword(current:string,next:string){if(!await authenticate(process.env.ADMIN_USERNAME??"admin",current))return false;const file=passwordFile();await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,await bcrypt.hash(next,12),{encoding:"utf8",mode:0o600});await rename(temp,file);return true;}
export async function makeSession() { return new SignJWT({ admin: true,version:await credentialVersion() }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret()); }
export async function isAdmin(token?: string) { if (!token) return false; try { const payload=(await jwtVerify(token, secret())).payload;return payload.admin === true&&payload.version===await credentialVersion(); } catch { return false; } }
