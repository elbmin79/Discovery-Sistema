import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const secret = "history-local-integration-secret-at-least-32-characters";
export function testToken(role) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ role, iss: "supabase", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url");
  return `${header}.${body}.${createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url")}`;
}
export function compose(args, input) {
  return execFileSync("docker", ["compose", "-f", "tests/storage.compose.yml", ...args], { encoding: "utf8", input, env: { ...process.env, HISTORY_TEST_ANON_KEY: testToken("anon"), HISTORY_TEST_SERVICE_KEY: testToken("service_role") }, stdio: ["pipe", "pipe", "pipe"] });
}
export function sql(query) {
  return compose(["exec", "-T", "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], query).trim();
}
async function start() {
  compose(["down", "--volumes"]);
  compose(["up", "-d", "--wait", "db"]);
  sql("alter role postgres password 'history-local-test'; alter role supabase_storage_admin password 'history-local-test';");
  compose(["up", "-d", "rest", "storage"]);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch("http://127.0.0.1:15441/status")).ok) break; } catch {}
    if (attempt === 59) throw new Error("Storage local no inició.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  for (const file of readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort()) sql(readFileSync(`supabase/migrations/${file}`, "utf8"));
  sql("notify pgrst, 'reload schema';");
  console.log("Local Postgres, PostgREST and private Storage ready.");
}

if (process.argv[1]?.endsWith("test-storage-start.mjs")) start().catch((error) => { console.error(error.message); process.exitCode = 1; });
