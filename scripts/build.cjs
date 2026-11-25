const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([path.join(root, "scripts/generate-clients.cjs")]);
run([path.join(root, "node_modules/next/dist/bin/next"), "build"]);
