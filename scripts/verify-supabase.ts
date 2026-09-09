import { isArchiveStoreReady, readSnapshot } from "../src/lib/store";
import { isSupabaseConfigured } from "../src/lib/supabase/admin";

async function main() {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    }
    await readSnapshot();
    if (!(await isArchiveStoreReady())) {
      throw new Error("Faltan tablas o funciones del archivo histórico.");
    }
    console.log("Supabase está listo para este despliegue.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Supabase no está listo: ${message}`);
    process.exitCode = 1;
  }
}

void main();
