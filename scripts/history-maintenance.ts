import { backfillHistory, maintainHistory } from "../src/lib/store/history-maintenance";

async function main() {
  const action = process.argv[2];
  if (action === "backfill") console.log(JSON.stringify(await backfillHistory()));
  else if (action === "retention") console.log(JSON.stringify(await maintainHistory()));
  else throw new Error("Usa backfill o retention.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falló el mantenimiento.");
  process.exitCode = 1;
});
