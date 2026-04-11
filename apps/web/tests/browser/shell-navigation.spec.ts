import { expect, test } from "@playwright/test";

test.describe("shell browser smoke", () => {
  test("desktop navigation keeps the shell chrome stable", async ({ page }) => {
    await page.goto("/dashboard");

    const shell = page.getByTestId("shell-frame-main");
    await expect(shell).toBeVisible();
    await expect(shell.getByTestId("shell-page")).toBeVisible();
    await expect(shell.getByTestId("shell-main")).toBeVisible();
    await expect(shell.getByTestId("shell-section-label")).toHaveText("Dashboard");

    await page.getByRole("link", { name: "Inbox" }).click();
    await expect(page).toHaveURL(/\/inbox(?:\?.*)?$/);
    await expect(shell.getByTestId("shell-section-label")).toHaveText("Inbox");

    await page.getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(/\/review(?:\?.*)?$/);
    await expect(shell.getByTestId("shell-section-label")).toHaveText("Review");
  });

  test("command palette opens from shell chrome and can route to settings", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const shell = page.getByTestId("shell-frame-main");
    await page.getByRole("button", { name: "Search" }).click();

    const commandInput = page.getByPlaceholder("Type a command or search...");
    await expect(commandInput).toBeVisible();
    await commandInput.fill("settings");
    await page.getByRole("button", { name: /Settings/i }).first().click();

    await expect(page).toHaveURL(/\/settings(?:\?.*)?$/);
    await expect(shell.getByTestId("shell-section-label")).toHaveText(
      "Settings",
    );
    await expect(page.getByText("Preferences", { exact: true })).toBeVisible();
  });

  test("mobile sidebar opens and routes to execution", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const shell = page.getByTestId("shell-frame-main");
    await expect(shell.getByTestId("shell-section-label")).toHaveText("Dashboard");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(shell.getByTestId("shell-sidebar")).toBeVisible();

    await page.getByRole("link", { name: "Execution" }).click();
    await expect(page).toHaveURL(/\/execution(?:\?.*)?$/);
    await expect(shell.getByTestId("shell-section-label")).toHaveText("Execution");
    await expect(shell.getByTestId("shell-page")).toBeVisible();
  });

  test("protected settings surface loads with the configured admin token", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/\/settings(?:\?.*)?$/);
    await expect(page.getByRole("link", { name: "Back to app" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Preferences", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Connections", exact: true }),
    ).toBeVisible();
  });
});
