import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
process.env.DATABASE_URL??="file:./dev.db";
export default defineConfig({resolve:{alias:{"@":path.resolve(root,"src")}},test:{environment:"node"}});
