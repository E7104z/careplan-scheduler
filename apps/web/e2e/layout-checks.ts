import { expect, type Page } from "@playwright/test";

// Phone checks shared by e2e/public/phone.spec.ts and e2e/emulated/phone.spec.ts (390 × 844).

/** AC-19: the page never scrolls sideways; wide content (the weekly grid) scrolls in its panel. */
export async function expectNoPageScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth, wide } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    // What sticks out past the right edge, so a failure says what to fix: the outermost elements,
    // and positioned ones (an `sr-only` label whose containing block is outside a scroll panel
    // isn't clipped by it).
    const past = (el: Element) => el.getBoundingClientRect().right > width + 1;
    const wide = [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter(past)
      .filter((el) => /absolute|fixed/.test(getComputedStyle(el).position) || !(el.parentElement && past(el.parentElement)))
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}"> right ${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: width, wide };
  });
  expect(scrollWidth, `the page scrolls sideways:\n${wide.join("\n")}`).toBeLessThanOrEqual(clientWidth);
}

/** AC-19: the weekly grid is wider than its panel and scrolls inside it. */
export async function expectGridScrollsInPanel(page: Page): Promise<void> {
  const gridWrap = page.locator(".overflow-x-auto", { has: page.getByRole("table") }).first();
  await expect(gridWrap).toBeVisible();
  expect(await gridWrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
}

/** APP-SPEC 4.4: under 640px every visible button and toggle is at least 44 × 44 px. */
export async function expectTouchTargets(page: Page): Promise<void> {
  const tooSmall: string[] = [];
  for (const target of await page.locator("button, [role='button']").all()) {
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    // A visually hidden (1px, screen reader only) element isn't a touch target.
    if (!box || box.width <= 1 || box.height <= 1) continue;
    if (box.width >= 44 && box.height >= 44) continue;
    const name = (await target.getAttribute("aria-label")) ?? (await target.innerText()).trim();
    tooSmall.push(`${name} (${Math.round(box.width)} × ${Math.round(box.height)})`);
  }
  expect(tooSmall, "buttons smaller than 44 × 44 px").toEqual([]);
}

/** Both phone checks for the page as it is now. */
export async function expectPhoneLayout(page: Page): Promise<void> {
  await expectNoPageScroll(page);
  await expectTouchTargets(page);
}
