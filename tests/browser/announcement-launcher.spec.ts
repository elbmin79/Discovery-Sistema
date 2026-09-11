import { expect, test } from "@playwright/test";
import { createSeedSnapshot } from "../../src/lib/seed/demo-data";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`announcement launcher scrolls, opens, clears badges and closes with ${reducedMotion}`, async ({ page }) => {
    const snapshot = createSeedSnapshot();
    snapshot.latePickups = [];
    snapshot.announcements = snapshot.announcements.slice(0, 1);
    snapshot.guardians.find((guardian) => guardian.id === "g-roberto")!.readAnnouncementIds = [];
    await page.route("**/api/state", (route) => route.fulfill({ json: snapshot }));
    await page.route("**/api/school/announcements/*", (route) => {
      snapshot.guardians.find((guardian) => guardian.id === "g-roberto")!.readAnnouncementIds = snapshot.announcements.map((item) => item.id);
      snapshot.updatedAt = new Date().toISOString();
      return route.fulfill({ json: snapshot });
    });
    await page.addInitScript(() => {
      sessionStorage.setItem("discovery-session", JSON.stringify({ role: "parent", guardianId: "g-roberto", username: "roberto", name: "Roberto Madrid" }));
      Object.defineProperty(navigator, "setAppBadge", { value: async (count: number) => { document.documentElement.dataset.appBadge = String(count); } });
      Object.defineProperty(navigator, "clearAppBadge", { value: async () => { document.documentElement.dataset.appBadge = "0"; } });
    });
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/familia");
    const launcher = page.locator("header").getByRole("button", { name: "Avisos de la escuela", exact: true });
    await expect(launcher.locator("[data-announcement-badge]")).toHaveText("1");
    await expect(page.locator("html")).toHaveAttribute("data-app-badge", "1");
    await launcher.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await page.locator("[data-announcements-launcher]").evaluate((button) => button.closest('.overflow-y-auto')!.scrollTop)).toBeGreaterThan(0);
    await expect(dialog.getByRole("button", { name: /Recientes/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Anteriores/ })).toBeVisible();
    await page.screenshot({ path: `test-results/announcements-${reducedMotion}.png`, animations: "disabled" });
    await dialog.getByRole("button", { name: new RegExp(snapshot.announcements[0].title) }).click();
    await expect(dialog.getByRole("heading", { name: snapshot.announcements[0].title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-app-badge", "0");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(launcher.locator("[data-announcement-badge]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
