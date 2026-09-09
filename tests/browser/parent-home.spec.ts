import { expect, test, type Page } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";

async function login(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.request.post("/api/demo/reset")).ok()).toBeTruthy();
  await page.goto("/familia");
  await page.getByLabel("Usuario").fill("roberto");
  await page.getByLabel("Contraseña").fill("madrid");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  for (const notice of snapshot.latePickups.filter((late) => late.guardianId === "g-roberto" && late.status === "announced")) {
    expect((await page.request.post(`/api/late/${notice.id}`, { data: { action: "cancel" } })).ok()).toBeTruthy();
  }
  await page.reload();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
}

test("cancel a plan, see the home and school contact, then create a new pickup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await expect(page.getByText(/Se cancelará el pase de/)).toContainText("Sofía");
  await page.getByRole("button", { name: "Conservar plan" }).click();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar recogida" }).click();
  await expect(page.getByRole("status")).toHaveText("Recogida de hoy cancelada");
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible();
  await expect(page.getByText("De la escuela", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contactar a la escuela/ })).toHaveAttribute("href", "tel:+526868378517");
  expect((await page.request.post("/api/trips/arrive", { data: { code: "4170" } })).ok()).toBe(false);
  await expect(page.locator('img[src*="school-welcome"]')).toBeVisible();
  await expect(page.locator('img[src*="pickup-pass"]')).toBeVisible();
  await expect(page.locator('img[src*="students/s-sofia.png"]')).toHaveCount(1);
  await expect(page.locator('img[src*="students/s-lucas.png"]')).toHaveCount(1);
  await expect(page.getByRole("img", { name: "Discovery", exact: true })).toBeVisible();
  await expect(page.locator("nav").getByRole("button", { name: "Inicio", exact: true })).toBeVisible();
  await expect(page.locator("nav").getByRole("button", { name: "Cuenta", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/parent-home-es.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create pickup", exact: true })).toBeVisible();
  await expect(page.getByText("From the school", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contact the school/ })).toBeVisible();
  await page.screenshot({ path: "test-results/parent-home-en.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Create pickup", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/parent-home-small.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByRole("link", { name: /Contact the school/ }).scrollIntoViewIfNeeded();
  await expect(page.locator("nav").getByRole("button", { name: "Home", exact: true })).toBeInViewport();
  await page.screenshot({ path: "test-results/parent-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Crear Pick-Up", exact: true }).click();
  await page.getByRole("button", { name: /Sofía Madrid/ }).click();
  await page.getByRole("button", { name: /Lucas Madrid/ }).click();
  await page.getByRole("button", { name: "Pase para todos" }).click();
  await page.getByRole("button", { name: "Generar pase de recogida" }).click();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("late notice replaces the plan, persists, appears to the office, and can be updated and cancelled", async ({ page, browser }) => {
  await login(page);
  await page.getByRole("button", { name: "¿Llegarás tarde? Avisar al colegio", exact: true }).click();
  await expect(page.getByRole("note")).toContainText("Sofía");
  await expect(page.getByRole("note")).toContainText("Lucas");
  await page.getByRole("button", { name: "+30", exact: true }).click();
  await page.locator("textarea").fill("Aviso de prueba: cita familiar");
  await page.getByRole("button", { name: "Avisar al colegio", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Aviso enviado y recogida de hoy cancelada");
  await expect(page.getByRole("status")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  expect(snapshot.trips.some((trip) => trip.id === "t-madrid-today")).toBe(false);
  const late = snapshot.latePickups.find((notice) => notice.guardianId === "g-roberto" && notice.status === "announced")!;
  expect(late.studentIds).toHaveLength(2);
  const officeContext = await browser.newContext();
  const office = await officeContext.newPage();
  await office.goto("http://localhost:3105/admin");
  await office.getByPlaceholder("Usuario").fill("gabriela");
  await office.getByPlaceholder("Contraseña").fill("salida");
  await office.getByRole("button", { name: "Entrar al tablero", exact: true }).click();
  const lateSection = office.locator("section").filter({ has: office.getByRole("heading", { name: /Retrasos/ }) });
  await expect(lateSection.getByText("Aviso de prueba: cita familiar", { exact: false })).toBeVisible();
  await officeContext.close();
  await page.reload();
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/parent-home-late.png", fullPage: true });
  await page.getByRole("button", { name: "Actualizar hora", exact: false }).last().click();
  await page.getByRole("button", { name: "+1h", exact: true }).click();
  await page.getByRole("button", { name: "Actualizar hora", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Hora estimada actualizada");
  await page.getByRole("button", { name: "Actualizar hora", exact: false }).last().click();
  await page.getByRole("button", { name: "Cancelar aviso" }).click();
  await expect(page.getByRole("status")).toContainText("Aviso cancelado");
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /¿Llegarás tarde\?/ }).click();
  await expect(page.getByRole("note")).toHaveCount(0);
  await page.getByRole("button", { name: /Sofía Madrid/ }).click();
  await page.getByRole("button", { name: "+15", exact: true }).click();
  await page.getByRole("button", { name: "Avisar al colegio", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Aviso de retraso enviado");
});

test("failed cancellation retains the plan and concurrent arrival prevents late replacement", async ({ page }) => {
  await login(page);
  await page.route("**/api/trips/t-madrid-today/cancel", (route) => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ error: "No se pudo guardar el cambio." }),
  }));
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar recogida" }).click();
  await expect(page.getByText("No se pudo guardar el cambio.")).toBeVisible();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  await page.unroute("**/api/trips/t-madrid-today/cancel");
  await page.getByRole("button", { name: "¿Llegarás tarde? Avisar al colegio", exact: true }).click();
  await page.getByRole("button", { name: "+30", exact: true }).click();
  await page.route("**/api/late", async (route) => {
    expect((await page.request.post("/api/trips/arrive", { data: { code: "4170" } })).ok()).toBeTruthy();
    await route.continue();
  });
  await page.getByRole("button", { name: "Avisar al colegio", exact: true }).click();
  await expect(page.getByText("La recogida ya llegó al kiosco. Contacta a la oficina.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Contactar a la escuela/ })).toHaveAttribute("href", "tel:+526868378517");
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  expect(snapshot.trips.find((trip) => trip.id === "t-madrid-today")?.arrivedAt).toBeTruthy();
  expect(snapshot.latePickups.some((late) => late.guardianId === "g-roberto" && late.status === "announced")).toBe(false);
});

test("API requires a parent session and rejects another guardian's cancellation", async ({ page, playwright }) => {
  await login(page);
  const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3105" });
  expect((await anonymous.post("/api/trips/t-madrid-today/cancel")).status()).toBe(401);
  expect((await anonymous.post("/api/late", { data: { guardianId: "g-roberto" } })).status()).toBe(401);
  await anonymous.dispose();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  const other = snapshot.trips.find((trip) => trip.guardianId === "g-benjamin")!;
  expect((await page.request.post(`/api/trips/${other.id}/cancel`)).ok()).toBe(false);
  expect((await page.request.post("/api/late", { data: { guardianId: "g-benjamin" } })).status()).toBe(403);
});
