import { expect, test, type Page } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";
import { createMadridPlan, createMarquezPlan } from "./helpers";

async function login(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.request.post("/api/demo/reset")).ok()).toBeTruthy();
  const trip = await createMadridPlan(page.request);
  await page.goto("/familia");
  await page.getByLabel("Usuario").fill("roberto");
  await page.getByLabel("Contraseña").fill("madrid");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  return trip;
}

test("cancel a plan, see the home and school contact, then create a new pickup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const trip = await login(page);
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await expect(page.getByText(/Se cancelará el pase de/)).toContainText("Sofía");
  await page.getByRole("button", { name: "Conservar plan" }).click();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar recogida" }).click();
  await expect(page.getByRole("status")).toHaveText("Recogida de hoy cancelada");
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 6000 });
  const cancelled: Snapshot = await (await page.request.get("/api/state")).json();
  expect(cancelled.trips.some((item) => item.id === trip.id)).toBe(false);
  expect(cancelled.requests.some((request) => request.tripId === trip.id)).toBe(false);
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible();
  await expect(page.getByText("De la escuela", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contactar a la escuela/ })).toHaveAttribute("href", "tel:+526868378517");
  expect((await page.request.post("/api/trips/arrive", { data: { code: trip.code } })).ok()).toBe(false);
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

for (const arrivalVia of ["tag", "qr"] as const) {
  test(`accepted ${arrivalVia} arrival shows updated copy and can cancel pickup`, async ({ page }) => {
    const trip = await login(page);
    const response = arrivalVia === "tag"
      ? await page.request.post("/api/trips/arrive-tag", { data: { tagId: "DSC-0417" } })
      : await page.request.post("/api/trips/arrive", { data: { token: trip.qrToken, via: "qr" } });
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText(arrivalVia === "tag" ? "Tu tag fue aceptado" : "Tu llegada fue aceptada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar recogida", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Recogida de hoy cancelada");
    const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
    expect(snapshot.trips.some((item) => item.id === trip.id)).toBe(false);
    expect(snapshot.requests.some((item) => item.tripId === trip.id)).toBe(false);
  });
}

test("late notice replaces the plan, persists, appears to the office, and can be updated and cancelled", async ({ page, browser }) => {
  const trip = await login(page);
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
  expect(snapshot.trips.some((item) => item.id === trip.id)).toBe(false);
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
  const trip = await login(page);
  await page.route(`**/api/trips/${trip.id}/cancel`, (route) => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ error: "No se pudo guardar el cambio." }),
  }));
  await page.getByRole("button", { name: "Cancelar recogida de hoy", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar recogida" }).click();
  await expect(page.getByText("No se pudo guardar el cambio.")).toBeVisible();
  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  await page.unroute(`**/api/trips/${trip.id}/cancel`);
  await page.getByRole("button", { name: "¿Llegarás tarde? Avisar al colegio", exact: true }).click();
  await page.getByRole("button", { name: "+30", exact: true }).click();
  await page.route("**/api/late", async (route) => {
    expect((await page.request.post("/api/trips/arrive", { data: { code: trip.code } })).ok()).toBeTruthy();
    await route.continue();
  });
  await page.getByRole("button", { name: "Avisar al colegio", exact: true }).click();
  await expect(page.getByText("La recogida ya llegó al kiosco. Contacta a la oficina.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Contactar a la escuela/ })).toHaveAttribute("href", "tel:+526868378517");
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  expect(snapshot.trips.find((item) => item.id === trip.id)?.arrivedAt).toBeTruthy();
  expect(snapshot.latePickups.some((late) => late.guardianId === "g-roberto" && late.status === "announced")).toBe(false);
});

test("API requires a parent session and rejects another guardian's cancellation", async ({ page, playwright }) => {
  const trip = await login(page);
  await createMarquezPlan(page.request);
  const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3105" });
  expect((await anonymous.post(`/api/trips/${trip.id}/cancel`)).status()).toBe(401);
  expect((await anonymous.post("/api/late", { data: { guardianId: "g-roberto" } })).status()).toBe(401);
  await anonymous.dispose();
  const snapshot: Snapshot = await (await page.request.get("/api/state")).json();
  const other = snapshot.trips.find((item) => item.guardianId === "g-benjamin")!;
  expect((await page.request.post(`/api/trips/${other.id}/cancel`)).ok()).toBe(false);
  expect((await page.request.post("/api/late", { data: { guardianId: "g-benjamin" } })).status()).toBe(403);
});
