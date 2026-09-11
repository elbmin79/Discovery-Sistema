import { expect, test } from "@playwright/test";
import { createSeedSnapshot } from "../../src/lib/seed/demo-data";

test("familia keeps first-last names in plans, settings, selection and authorized pickers", async ({ page }) => {
  const snapshot = createSeedSnapshot();
  snapshot.latePickups = [];
  await page.route("**/api/state", (route) => route.fulfill({ json: snapshot }));
  await page.addInitScript(() => sessionStorage.setItem("discovery-session", JSON.stringify({ role: "parent", guardianId: "g-roberto", username: "roberto", name: "Roberto Madrid" })));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/familia");
  await expect(page.getByText("Sofía Madrid Herrera", { exact: true })).toBeVisible();
  await expect(page.getByText("Papá · Roberto Madrid", { exact: true })).toBeVisible();
  await expect(page.getByText("Madrid Herrera Sofía", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Roberto Madrid", exact: true })).toBeVisible();
  await expect(page.getByText("Sofía Madrid Herrera", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Inicio", exact: true }).click();
  await page.getByRole("button", { name: "Cambiar el plan de hoy" }).click();
  await expect(page.getByRole("button", { name: /Sofía Madrid/ })).toBeVisible();
  await page.getByRole("button", { name: "Pase para todos" }).click();
  await expect(page.getByRole("button", { name: /Rosa Madrid/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Madrid Rosa/ })).toHaveCount(0);
});
