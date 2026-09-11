import { expect, test, type Locator } from "@playwright/test";
import { createSeedSnapshot, withDemoFamilyPlans } from "../../src/lib/seed/demo-data";
import { buildHistoryRow, historyPage } from "../../src/lib/history";
import { todayJornada } from "../../src/lib/school";

async function expectUnclipped(name: Locator) {
  await expect(name).toBeVisible();
  await name.scrollIntoViewIfNeeded();
  expect(await name.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1)).toBe(true);
}

test("long compound surnames remain readable across parent, guest, staff, admin and kiosk screens", async ({ page }) => {
  const snapshot = withDemoFamilyPlans(createSeedSnapshot());
  snapshot.latePickups = [];
  const surname = "Fernández de la Torre Hernández";
  for (const student of snapshot.students.filter((student) => ["s-sofia", "s-lucas"].includes(student.id))) student.lastName = surname;
  const trip = snapshot.trips.find((trip) => trip.id === "t-madrid-today")!;
  await page.route("**/api/state", (route) => route.fulfill({ json: snapshot }));
  await page.route("**/api/history?*", (route) => route.fulfill({ json: historyPage([buildHistoryRow(snapshot, trip, true)], todayJornada(), todayJornada(), 200, 0) }));
  await page.addInitScript(() => !sessionStorage.getItem("discovery-session") && sessionStorage.setItem("discovery-session", JSON.stringify({ role: "parent", guardianId: "g-roberto", username: "roberto", name: "Roberto Madrid" })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/familia");
  await expectUnclipped(page.getByText(`Sofía ${surname}`, { exact: true }));
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await expectUnclipped(page.getByText(`Sofía ${surname}`, { exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/pase/${trip.qrToken}`);
  await expectUnclipped(page.getByText(`${surname} Sofía`, { exact: true }));
  await page.evaluate(() => sessionStorage.setItem("discovery-session", JSON.stringify({ role: "staff", staffId: "st-gabriela", isAdmin: true, name: "Gabriela" })));
  trip.arrivedAt = new Date().toISOString();
  snapshot.requests.filter((request) => request.tripId === trip.id).forEach((request) => { request.status = "arrived"; request.arrivedAt = trip.arrivedAt; });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/personal");
  await expectUnclipped(page.locator("article").getByText(surname, { exact: true }).first());
  await page.screenshot({ path: "test-results/surnames-staff.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expectUnclipped(page.getByText(`${surname} Sofía`, { exact: true }).last());
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/kiosco");
  await page.getByRole("button", { name: "QR o código", exact: true }).click();
  for (const digit of trip.code) await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expectUnclipped(page.getByText(`${surname} Sofía`, { exact: true }).first());
});
