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
    { steps: 12 },
  );
  await page.mouse.up();
}
test("cutting both supports causes a real collapse and a one-shot clear", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  await swipe(page, [50, 290], [550, 290]);
  await expect(page.locator("#shots")).toHaveText("2");
  await expect(page.getByText("STRUCTURE SOLVED")).toBeVisible({
    timeout: 10000,
  });
  expect(
    Number((await page.locator("#percent").textContent()).replace("%", "")),
  ).toBeGreaterThanOrEqual(80);
  await page.reload();
  await expect(page.locator("#best")).not.toHaveText("—");
  expect(errors).toEqual([]);
});
test("wrong support loses crystals while the other support solves the same layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#level-select").selectOption("1");
  await swipe(page, [410, 280], [490, 280]);
  await expect(page.getByText("RETHINK THE SUPPORT")).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "もう一度", exact: false }).click();
  await swipe(page, [110, 280], [190, 280]);
  await expect(page.getByText("STRUCTURE SOLVED")).toBeVisible({
    timeout: 10000,
  });
});
test("mobile aim cancellation spends no shot, and pause/settings freeze the world", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる" }).click();
  const r = await page.locator("canvas").boundingBox();
  await page.mouse.move(r.x + 30, r.y + 150);
  await page.mouse.down();
  await page.mouse.move(r.x + 220, r.y + 150);
  await page.locator("canvas").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator("#shots")).toHaveText("3");
  await page.getByRole("button", { name: "一時停止" }).click();
  await expect(page.getByText("次の一手を。")).toBeVisible();
  await page.getByRole("button", { name: "つづける" }).click();
  await page.getByRole("button", { name: "設定" }).click();
  await page.locator("#sound").uncheck();
  await page.locator("#close").click();
  await page.getByRole("button", { name: "つづける" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/cascade-mobile.png",
    fullPage: true,
  });
});
test("cores resonate after collapse and the final result supports replay", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#level-select").selectOption("2");
  await swipe(page, [30, 280], [570, 280]);
  await expect(page.getByText("STRUCTURE SOLVED")).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "もう一周、より少なく" }).click();
  await expect(page.locator("#wave")).toContainText("01 /");
  await expect(page.locator("#shots")).toHaveText("3");
  await page.screenshot({
    path: "test-results/cascade-desktop.png",
    fullPage: true,
  });
});
