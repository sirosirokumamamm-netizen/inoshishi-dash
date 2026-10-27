import { test, expect } from "@playwright/test";
async function swipe(page, a, b) {
  const r = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    r.x + (a[0] / 600) * r.width,
    r.y + (a[1] / 800) * r.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    r.x + (b[0] / 600) * r.width,
    r.y + (b[1] / 800) * r.height,
    { steps: 20 },
  );
  await page.mouse.up();
}
test("physical slicing awards score; pause freezes time and resume works", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  await swipe(page, [40, 210], [560, 210]);
  await expect(page.locator("#score")).not.toHaveText("0");
  await page.locator("#pause").click();
  const time = await page.locator("#time").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#time")).toHaveText(time);
  await page.getByRole("button", { name: "つづける" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/flow-desktop.png",
    fullPage: true,
  });
});
test("mobile slicing, settings and cancellation work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  await swipe(page, [40, 210], [560, 210]);
  await expect(page.locator("#score")).not.toHaveText("0");
  await page.getByRole("button", { name: "設定" }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.locator("#sound").uncheck();
  await page.locator("#effects").uncheck();
  await page.locator("#close").click();
  await page.getByRole("button", { name: "つづける" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/flow-mobile.png",
    fullPage: true,
  });
});
test("timer reaches results and replay resets score", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  await swipe(page, [40, 210], [560, 210]);
  await page.clock.runFor(70000);
  await expect(page.getByText("SESSION COMPLETE")).toBeVisible();
  await page.getByRole("button", { name: "もう一度、切る" }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#time")).toHaveText("60");
});
test("a second cut releases actual fragments and repeated cuts charge overdrive", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  await swipe(page, [30, 210], [570, 210]);
  await swipe(page, [125, 110], [125, 400]);
  await expect(page.locator("#goal")).not.toHaveText("0 / 10 CLEARED");
  for (const y of [395, 580]) await swipe(page, [30, y], [570, y]);
  for (const x of [125, 295, 465]) await swipe(page, [x, 80], [x, 740]);
  await expect(page.locator("#pulse")).toBeEnabled();
  await page.locator("#pulse").click();
  await expect(page.locator("#status")).toContainText("OVERDRIVE");
});
