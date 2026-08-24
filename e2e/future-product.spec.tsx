import { expect, test, type Page } from '@playwright/test'
async function openFixture(page: Page, view: 'card' | 'detail') {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/future-product-fixture.html?view=${view}`)
}

test('producto futuro parcial degrada PlanCard sin afirmaciones falsas', async ({ page }) => {
  await openFixture(page, 'card')
  await expect(page.getByText('Alternativa para planificar')).toBeVisible()
  await expect(page.getByText('Alojamiento no informado')).toBeVisible()
  await expect(page.getByLabel('Precio del producto Tomorrowland').getByText('Precio aún no publicado')).toBeVisible()
  await expect(page.getByText('Alojamiento por separado')).toHaveCount(0)
  await expect(page.getByText('Regular')).toHaveCount(0)
  await page.screenshot({ path: 'e2e-artifacts/future-products/future-product-390.png', fullPage: true })
})

test('producto futuro parcial degrada detalle y presupuesto', async ({ page }) => {
  await openFixture(page, 'detail')
  await expect(page.getByText('Información parcial sin clasificar')).toBeVisible()
  await expect(page.getByText('Disponible al publicarse el precio')).toBeVisible()
  await expect(page.getByText('Producto oficial')).toHaveCount(0)
  await page.screenshot({ path: 'e2e-artifacts/future-products/future-product-detail-390.png', fullPage: true })
})
