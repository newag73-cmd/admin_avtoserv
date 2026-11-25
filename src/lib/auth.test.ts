import {afterEach,describe,expect,it} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {authenticate,changeAdminPassword,isAdmin,makeSession} from "./auth";

describe("admin password change",()=>{
  let temp="";
  const prior={data:process.env.DATA_DIR,password:process.env.ADMIN_PASSWORD,hash:process.env.ADMIN_PASSWORD_HASH};
  afterEach(async()=>{if(temp)await rm(temp,{recursive:true,force:true});if(prior.data===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=prior.data;if(prior.password===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=prior.password;if(prior.hash===undefined)delete process.env.ADMIN_PASSWORD_HASH;else process.env.ADMIN_PASSWORD_HASH=prior.hash;});
  it("persists the new password and invalidates the old session",async()=>{
    temp=await mkdtemp(path.join(os.tmpdir(),"admin-password-"));process.env.DATA_DIR=temp;process.env.ADMIN_PASSWORD="old-local-password";delete process.env.ADMIN_PASSWORD_HASH;
    const oldSession=await makeSession();expect(await isAdmin(oldSession)).toBe(true);
    expect(await changeAdminPassword("wrong-password","new-long-password-123")).toBe(false);
    expect(await changeAdminPassword("old-local-password","new-long-password-123")).toBe(true);
    expect(await authenticate("admin","old-local-password")).toBe(false);
    expect(await authenticate("admin","new-long-password-123")).toBe(true);
    expect(await isAdmin(oldSession)).toBe(false);
    expect(await isAdmin(await makeSession())).toBe(true);
  },15000);
});
