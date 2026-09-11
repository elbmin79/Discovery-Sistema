import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";

test("family sees, edits, scans and completes today's prepared plan", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.request.post("/api/demo/reset")).ok()).toBeTruthy();
  await page.goto("/familia");
  await page.getByLabel("Usuario").fill("roberto");
  await page.getByLabel("Contraseña").fill("madrid");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByText("Plan de hoy", { exact: true })).toBeVisible();
  await expect(page.getByText("2:30 p.m.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Papá · Roberto Madrid", { exact: true })).toBeVisible();
  await expect(page.getByText("DSC-0417", { exact: true })).toBeVisible();
  await expect(page.getByText("Sofía Madrid Herrera", { exact: true })).toBeVisible();
  await expect(page.getByText("Lucas Madrid Herrera", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Cambiar el plan de hoy" }).click();
  await page.getByRole("button", { name: "Pase para todos" }).click();
  await page.getByRole("button", { name: /Rosa Madrid/ }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Abuela · Rosa Madrid", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Código QR" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await page.getByRole("button", { name: "Ampliar código QR" }).click();
  const fullScreenQr = page.getByRole("button", { name: "Cerrar código QR" });
  await expect(fullScreenQr).toBeVisible();
  await expect(fullScreenQr.getByRole("img", { name: "Código QR" })).toBeVisible();
  expect(await fullScreenQr.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await fullScreenQr.click();
  await expect(page.getByRole("button", { name: "Cerrar código QR" })).toHaveCount(0);

  const before: Snapshot = await (await page.request.get("/api/state")).json();
  const trip = before.trips.find((item) => item.id === "t-madrid-today")!;
  expect(trip.code).toBe("4170");
  expect((await page.request.post("/api/trips/arrive", { data: { code: trip.code } })).ok()).toBeTruthy();
  await expect(page.getByText("Tu pase de hoy", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("En la fila", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cambiar el plan de hoy" })).toHaveCount(0);

  expect((await page.request.post(`/api/trips/${trip.id}/deliver`, { data: { staffName: "Mtra. Alejandra Ríos" } })).ok()).toBeTruthy();
  await expect(page.getByText("Entrega con éxito", { exact: true })).toBeVisible({ timeout: 5000 });
  expect((await page.request.post(`/api/trips/${trip.id}/depart`, { data: { via: "parent" } })).ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Crear Pick-Up", exact: true })).toBeVisible({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test("today plan is fully translated to English", async ({ page }) => {
  expect((await page.request.post("/api/demo/reset")).ok()).toBeTruthy();
  await page.goto("/familia");
  await page.getByLabel("Usuario").fill("benjamin");
  await page.getByLabel("Contraseña").fill("marquez");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByText("Today's plan", { exact: true })).toBeVisible();
  await expect(page.getByText("All set", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change today's plan" })).toBeVisible();
  await expect(page.getByText("Emiliano Márquez Espinoza", { exact: true })).toBeVisible();
  await expect(page.getByText("Isabela Márquez Espinoza", { exact: true })).toBeVisible();
  await expect(page.getByText("Paula Márquez Espinoza", { exact: true })).toBeVisible();
});
