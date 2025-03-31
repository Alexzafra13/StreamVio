// clients/web/tests/e2e/useFlow.test.js
const { test, expect } = require('@playwright/test');

// En lugar de test.describe, usa simplemente test
test('Flujo completo de usuario - desde registro hasta reproducción de contenido', async ({ page }) => {
  // 1. Visitar la página principal
  await page.goto("http://localhost:4321/");

  // Verificar que estamos en la página de inicio
  await expect(page.locator("h1")).toContainText("Bienvenido a StreamVio");

  // 2. Ir a la página de autenticación
  await page.click("text=Iniciar Sesión");

  // Verificar que estamos en la página de autenticación
  await expect(page).toHaveURL(/.*\/auth/);

    // 3. Registrar un nuevo usuario (con email único para evitar conflictos)
    const uniqueEmail = `test_${Date.now()}@example.com`;

    // Completar formulario de registro
    await page.locator('input[name="username"]').fill("testuser");
    await page.locator('input[name="email"]').fill(uniqueEmail);
    await page.locator('input[name="password"]').fill("testpassword123");
    await page.locator('input[name="confirmPassword"]').fill("testpassword123");

    // Enviar formulario
    await page.click('button:has-text("Crear Cuenta")');

    // 4. Verificar que se ha redirigido a la página principal y ahora está autenticado
    await expect(page).toHaveURL("http://localhost:4321/");

    // Verificar que aparece el nombre de usuario en la navegación
    await expect(page.locator("text=testuser")).toBeVisible();

    // 5. Navegar a la biblioteca de medios
    await page.click("text=Explorar contenido");

    // Verificar que estamos en la página de medios
    await expect(page).toHaveURL(/.*\/media/);

    // 6. Crear una biblioteca (si no existe)
    await page.click("text=Gestionar bibliotecas");

    // Verificar que estamos en la página de gestión de bibliotecas
    await expect(page).toHaveURL(/.*\/bibliotecas/);

    // Comprobar si hay bibliotecas, si no, crear una
    const hasLibraries = (await page.locator(".grid > div").count()) > 0;

    if (!hasLibraries) {
      await page.click("text=Añadir biblioteca");

      // Completar formulario
      await page.locator('input[name="name"]').fill("Biblioteca de prueba");
      await page.locator('input[name="path"]').fill("/tmp/test-library");
      await page.selectOption('select[name="type"]', "movies");

      // Guardar
      await page.click('button:has-text("Guardar")');

      // Verificar que se ha creado
      await expect(page.locator("text=Biblioteca de prueba")).toBeVisible();
    }

    // 7. Navegar a una película (simulado, ya que no podemos garantizar contenido)
    // En un entorno real, crearías contenido de prueba antes de ejecutar este test

    await page.goto("http://localhost:4321/media");

    // Buscar algún elemento multimedia
    const hasMedia = (await page.locator(".grid > div").count()) > 0;

    if (hasMedia) {
      // Hacer clic en el primer elemento
      await page.locator(".grid > div").first().click();

      // Verificar que estamos en la página de detalle
      await expect(page).toHaveURL(/.*\/media\/\d+/);

      // Verificar que el reproductor está presente
      await expect(page.locator("video")).toBeVisible();

      // Iniciar reproducción
      await page.locator("video").click();

      // Esperar a que comience la reproducción
      await page.waitForTimeout(5000);

      // Verificar que está reproduciendo (esto puede variar según la implementación)
      const isPlaying = await page.evaluate(() => {
        const video = document.querySelector("video");
        return !video.paused;
      });

      expect(isPlaying).toBe(true);
    }

    // 8. Cerrar sesión
    await page.click("text=testuser"); // Abrir menú de usuario
    await page.click("text=Cerrar Sesión");

    // Verificar que volvemos a ver el botón de iniciar sesión
    await expect(page.locator("text=Iniciar Sesión")).toBeVisible();
  });
});
