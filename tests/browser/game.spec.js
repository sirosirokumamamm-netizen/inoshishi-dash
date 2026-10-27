import { test, expect } from "@playwright/test";
async function swipe(page, a, b) {
  const r = await page.locator("#game").boundingBox();
  await page.mouse.move(
    r.x + (a[0] / 600) * r.width,
    r.y + (a[1] / 700) * r.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    r.x + (b[0] / 600) * r.width,
    r.y + (b[1] / 700) * r.height,
    { steps: 8 },
  );
  await page.mouse.up();
}
test("three aimed shots clear stage one and persist the best score", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "プレイする" }).click();
  for (const [i, y] of [235, 365, 495].entries()) {
    await swipe(page, [100, y], [500, y]);
    await expect(page.locator("#shots")).toHaveText(
      String(4 - i).padStart(2, "0"),
    );
    if (i < 2)
      await expect(page.locator("#arena-status")).toHaveText("READY TO SLICE");
  }
  await expect(page.getByText("鮮やかな、一手。")).toBeVisible();
  await expect(page.locator("#cleared")).toHaveText("100");
  await expect(page.locator("#score")).toHaveText("14599");
  await page.reload();
  await expect(page.locator("#best")).toHaveText("14,599");
  await expect(page.locator("#completed")).toHaveText("01 / 06");
  expect(errors).toEqual([]);
});
test("misses consume shots and failure supports immediate retry", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "プレイする" }).click();
  for (let i = 0; i < 5; i++) {
    await swipe(page, [100, 100], [500, 100]);
    if (i < 4)
      await expect(page.locator("#arena-status")).toHaveText("READY TO SLICE");
  }
  await expect(page.getByText("あと、ひと切り。")).toBeVisible();
  await expect(page.locator("#cleared")).toHaveText("0");
  await page.getByRole("button", { name: "もう一度挑戦" }).click();
  await expect(page.locator("#shots")).toHaveText("05");
  await expect(page.locator("#overlay")).toBeHidden();
});
test("short gestures, pause and settings do not spend shots", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "プレイする" }).click();
  await swipe(page, [100, 100], [105, 105]);
  await expect(page.locator("#shots")).toHaveText("05");
  await page.getByRole("button", { name: "一時停止" }).click();
  await expect(page.getByText("ひと休み。")).toBeVisible();
  await page.getByRole("button", { name: "ゲームに戻る" }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.locator('[data-setting="sound"]').uncheck();
  await page.locator('[data-setting="shake"]').uncheck();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.locator('[data-setting="sound"]')).not.toBeChecked();
  await expect(page.locator('[data-setting="shake"]')).not.toBeChecked();
});
test("mobile viewport supports touch swipes without horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "プレイする" }).click();
  await page.locator("#game").scrollIntoViewIfNeeded();
  const r = await page.locator("#game").boundingBox();
  const client = await context.newCDPSession(page);
  const p = (x, y) => ({
    x: r.x + (x / 600) * r.width,
    y: r.y + (y / 700) * r.height,
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [p(100, 235)],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [p(500, 235)],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#mobile-shots")).toHaveText("04");
  await expect(page.locator("#mobile-clear")).toHaveText("33%");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await context.close();
});
test("pulse charges through slicing and is consumed on the next shot", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-stage="4"]').click();
  // Diagonal cuts hit several blocks without immediately clearing them.
  await swipe(page, [90, 140], [510, 570]);
  await expect(page.locator("#arena-status")).toHaveText("READY TO SLICE");
  // Additional cuts across the moving field produce charge without modifying app state.
  for (let i = 0; i < 5; i++) {
    if (await page.locator("#pulse").isEnabled()) break;
    await swipe(page, [65, 300 + i * 55], [535, 300 + i * 55]);
    await expect(page.locator("#arena-status")).not.toHaveText(
      "FRAGMENTS IN MOTION",
    );
  }
  await expect(page.locator("#pulse")).toBeEnabled();
  await page.locator("#pulse").click();
  await expect(page.locator("#pulse-percent")).toHaveText("ARMED");
  await swipe(page, [50, 100], [550, 100]);
  await expect(page.locator("#pulse-percent")).toHaveText("0%");
});
test("stage selection, help and restart work", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-stage="2"]').click();
  await expect(page.locator("#stage-name")).toHaveText("ネオン・ステップ");
  await expect(page.locator("#shots")).toHaveText("07");
  await page.getByRole("button", { name: "遊び方" }).click();
  await expect(page.getByText("少ない一手で、大きく。")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ゲームに戻る" }).click();
  await swipe(page, [10, 100], [590, 100]);
  await expect(page.locator("#shots")).toHaveText("06");
  await page.getByRole("button", { name: "ステージをやり直す" }).click();
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  await expect(page.locator("#shots")).toHaveText("07");
  await expect(page.locator("#cleared")).toHaveText("0");
});
test("large pieces survive a cut, fall and can be sliced again", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-stage="1"]').click();
  await swipe(page, [165, 100], [165, 590]);
  await expect(page.locator("#shots")).toHaveText("07");
  await expect(page.locator("#cleared")).toHaveText("0");
  await expect(page.locator("#arena-status")).toHaveText("READY TO SLICE");
  await swipe(page, [95, 292], [230, 292]);
  await expect(page.locator("#shots")).toHaveText("06");
  await expect
    .poll(async () => Number(await page.locator("#cleared").textContent()))
    .toBeGreaterThan(0);
});
test("desktop field renders with local assets and no overflowing layout", async ({
  page,
}) => {
  const failures = [];
  page.on("requestfailed", (r) => failures.push(r.url()));
  await page.goto("/");
  await page.getByRole("button", { name: "プレイする" }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(failures).toEqual([]);
});
