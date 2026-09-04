import { test, expect } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";
import { todayJornada } from "../../src/lib/school";

test("kiosk captures 720p JPEG and staff and TV display the arrival photo", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1920; canvas.height = 1080;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#31513f"; context.fillRect(0, 0, 1920, 1080);
      return canvas.captureStream(10);
    } });
  });
  await page.goto("/kiosco");
  await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeVisible();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  const trip = snapshot.trips.find((item) => snapshot.requests.some((request) => request.tripId === item.id && (request.status === "on_the_way" || request.status === "arrived")))!;
  await page.keyboard.type(trip.code);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(1920);
  const arrivalRequest = page.waitForRequest((request) => request.url().endsWith("/api/trips/arrive") && request.method() === "POST");
  await page.getByRole("button", { name: "Confirmar llegada", exact: true }).click();
  const photo: string = (await arrivalRequest).postDataJSON().photo;
  expect(photo).toMatch(/^data:image\/jpeg;base64,/);
  const dimensions = await page.evaluate(async (src) => {
    const image = new Image(); image.src = src; await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, photo);
  expect(dimensions).toEqual([1280, 720]);
  await page.goto("/personal");
  await page.getByPlaceholder("Usuario").fill("gabriela");
  await page.getByPlaceholder("Contraseña").fill("salida");
  await page.getByRole("button", { name: "Entrar al tablero", exact: true }).click();
  await expect(page.getByRole("button", { name: "Más información", exact: true }).first()).toBeVisible();
  const buttons = page.getByRole("button", { name: "Más información", exact: true });
  let found = false;
  for (let index = 0; index < await buttons.count(); index += 1) {
    await buttons.nth(index).click();
    if (await page.getByText(/Foto de llegada/).isVisible()) { found = true; break; }
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  }
  expect(found).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/pantalla");
  await expect(page.getByText(/Foto de llegada/)).toBeVisible({ timeout: 30000 });
  const captured = page.locator('img[src^="data:image/jpeg"]');
  await expect(captured).toBeVisible();
  expect(await captured.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1280)).toBe(true);
});

test("office admin browses live history, ranges, lazy photos, CSV, and mobile details", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin");
  await page.getByPlaceholder("Usuario").fill("gabriela");
  await page.getByPlaceholder("Contraseña").fill("salida");
  await page.getByRole("button", { name: "Entrar al tablero", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  const trip = snapshot.trips.find((item) => snapshot.requests.some((request) => request.tripId === item.id && request.status === "on_the_way"))
    ?? snapshot.trips.find((item) => snapshot.requests.some((request) => request.tripId === item.id && request.status === "arrived"));
  expect(trip).toBeTruthy();
  const arrived = await page.request.post("/api/trips/arrive", { data: { code: trip!.code } });
  expect(arrived.ok()).toBeTruthy();
  let photoRequests = 0;
  const historyRequests: string[] = [];
  let stateRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/photos/")) photoRequests += 1;
    if (request.url().includes("/api/history?")) historyRequests.push(request.url());
    if (request.url().endsWith("/api/state")) stateRequests += 1;
  });
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("En vivo · se actualiza cada 2 segundos")).toBeVisible();
  expect(photoRequests).toBe(0);
  const info = page.getByRole("button", { name: `Información de ${trip!.code}`, exact: true }).filter({ visible: true });
  await expect(info).toBeVisible();
  await info.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Auto en la entrada" })).toBeVisible();
  await expect.poll(() => dialog.getByRole("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect((await page.request.post(`/api/trips/${trip!.id}/deliver`, { data: { staffName: "Administración" } })).ok()).toBeTruthy();
  expect((await page.request.post(`/api/trips/${trip!.id}/depart`, { data: { via: "staff" } })).ok()).toBeTruthy();
  await expect.poll(async () => {
    const row = page.locator("tr").filter({ has: info });
    return row.textContent();
  }, { timeout: 5000 }).toContain("Entregado");
  await expect(page.locator("tr").filter({ has: info })).not.toContainText("En vivo");
  const after: Snapshot = await (await page.request.get("/api/state")).json();
  expect(after.trips.some((item) => item.id === trip!.id)).toBe(false);
  for (const label of ["7 días", "30 días"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: "Exportar histórico CSV" })).toBeEnabled();
    const count = historyRequests.length;
    const stateCount = stateRequests;
    await page.waitForTimeout(2300);
    expect(historyRequests.length).toBe(count);
    expect(stateRequests).toBe(stateCount);
  }
  await page.getByRole("button", { name: "Personalizado", exact: true }).click();
  await page.getByLabel("Desde", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-01-02");
  await expect(page.getByText("No hay recogidas en este rango.")).toBeVisible();
  await page.getByLabel("Desde", { exact: true }).fill("2026-01-03");
  await expect(page.getByRole("alert").filter({ hasText: "rango de fechas válido" })).toBeVisible();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exportar histórico CSV" })).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar histórico CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`historico-${todayJornada()}-${todayJornada()}.csv`);
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain(trip!.code);
  expect(csv).not.toContain("data:image");
  expect(csv).not.toContain("token=");
  await page.screenshot({ path: testInfo.outputPath("history-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: `Información de ${trip!.code}`, exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("history-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});
