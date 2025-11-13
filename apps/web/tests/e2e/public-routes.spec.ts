import { test, expect } from "@playwright/test";

test.describe("Secciones públicas", () => {
  test("homepage muestra CTA y enlaces clave", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /coordina avales, firmas y pagos sin fricción/i })
    ).toBeVisible();

    const documentosLink = page.getByRole("link", { name: /documentos del aval/i }).first();
    await expect(documentosLink).toBeVisible();
    await expect(documentosLink).toHaveAttribute("href", "/documentos");

    const calendarioLink = page.getByRole("link", { name: /ver calendario público/i });
    await expect(calendarioLink).toHaveAttribute("href", "/calendario");
  });

  test("la página de documentos públicos siempre muestra el módulo", async ({ page }) => {
    await page.goto("/documentos");
    await expect(page.getByRole("heading", { name: /documentos del aval/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /actualizar/i })).toBeVisible();
    await expect(page.getByText("Documentos disponibles")).toBeVisible();
  });

  test("la lista negra pública carga los contenedores de vetos y clientes", async ({ page }) => {
    await page.goto("/lista-negra");

    await expect(page.getByRole("heading", { name: /vetos de avales/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /clientes vetados/i })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar aval o inmobiliaria")).toBeVisible();
    await expect(page.getByPlaceholder("Buscar cliente o motivo")).toBeVisible();
  });
});
