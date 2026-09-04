import { spawn } from "node:child_process";

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3105"], {
  stdio: "inherit",
  env: { ...process.env, SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SESSION_SECRET: "local-browser-test-session-secret" },
});
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => { process.exitCode = code ?? 0; });
