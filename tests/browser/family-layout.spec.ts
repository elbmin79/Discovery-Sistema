import { expect, test } from "@playwright/test";
import { createSeedSnapshot } from "../../src/lib/seed/demo-data";

test("family cards keep a consistent width and TV shows three children beside the car", async ({ page }) => {
  const snapshot = createSeedSnapshot();
  snapshot.latePickups = [];
  const trip = snapshot.trips.find((item) => item.id === "t-marquez-today")!;
  trip.arrivedAt = new Date(Date.now() - 600_000).toISOString();
  for (const request of snapshot.requests.filter((item) => item.tripId === trip.id)) {
    request.status = "arrived";
    request.arrivedAt = trip.arrivedAt;
  }
  await page.route("**/api/state", (route) => route.fulfill({ json: snapshot }));
  await page.addInitScript(() => sessionStorage.setItem("discovery-session", JSON.stringify({ role: "staff", staffId: "st-gabriela", username: "gabriela", name: "Núñez Gabriela" })));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/personal");
  const family = page.locator("article").filter({ hasText: "Entregar a los 3" });
  await expect(family).toBeVisible();
  const single = page.locator("article").filter({ hasText: "Auto 2" });
  expect(Math.abs((await family.boundingBox())!.width - (await single.boundingBox())!.width)).toBeLessThan(2);
  await expect(family).toContainText("Márquez");
  await page.screenshot({ path: "test-results/family-board.png", fullPage: true });
  await page.goto("/pantalla");
  const spotlight = page.locator("section.tv-in");
  await expect(spotlight).toContainText("Emiliano");
  await expect(spotlight).toContainText("Isabela");
  await expect(spotlight).toContainText("Paula");
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await expect(spotlight.getByText("Paula", { exact: true })).toBeInViewport();
    const car = spotlight.getByRole("img", { name: "Nissan Kicks gris", exact: true });
    await expect(car).toBeVisible();
    expect((await car.boundingBox())!.height).toBeGreaterThan(150);
    await page.screenshot({ path: `test-results/family-tv-${size.width}.png` });
  }
  expect(await page.locator('img[src*="students/"]').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test("mixed families rotate all children without hiding their surnames", async ({ page }) => {
  const snapshot = createSeedSnapshot();
  const trip = snapshot.trips.find((item) => item.id === "t-marquez-today")!;
  snapshot.trips = [trip];
  trip.arrivedAt = new Date().toISOString();
  const template = snapshot.requests.find((request) => request.tripId === trip.id)!;
  snapshot.requests = ["s-emiliano", "s-isabela", "s-sofia", "s-lucas"].map((studentId, index) => ({ ...template, id: `mixed-${index}`, studentId, status: "arrived", arrivedAt: trip.arrivedAt }));
  await page.route("**/api/state", (route) => route.fulfill({ json: snapshot }));
  await page.clock.install();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/pantalla");
  const spotlight = page.locator("section.tv-in");
  await expect(spotlight.getByText("Emiliano", { exact: true })).toBeInViewport();
  await expect(spotlight.getByText("Márquez Espinoza", { exact: true }).first()).toBeInViewport();
  await page.clock.runFor(3600);
  await expect(spotlight.getByText("Sofía", { exact: true })).toBeInViewport();
  await expect(spotlight.getByText("Lucas", { exact: true })).toBeInViewport();
  await expect(spotlight.getByText("Madrid Herrera", { exact: true }).first()).toBeInViewport();
  await page.screenshot({ path: "test-results/family-tv-mixed.png", animations: "disabled" });
});
