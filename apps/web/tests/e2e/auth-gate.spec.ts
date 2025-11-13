import { test, expect } from "@playwright/test";

test.describe("Guardado de acceso", () => {
  test("la página de login muestra el formulario", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status(), "La ruta /login debe existir").toBeLessThan(400);

    await expect(page.getByRole("heading", { name: /inicia sesión/i })).toBeVisible();
    await expect(page.getByLabel("Correo")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible();
  });

  test("un usuario sin sesión ve el mensaje de acceso restringido en /admin", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status(), "La ruta /admin debe devolver 200 con el guard").toBe(200);

    await expect(page.getByText("Necesitas iniciar sesión")).toBeVisible();
    const loginLink = page.getByRole("link", { name: /ir a iniciar sesión/i });
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});
