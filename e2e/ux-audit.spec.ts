import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const artifacts = 'e2e-artifacts'
const experiencesArtifacts = `${artifacts}/experiences-final`
const viewports = [
  { name: '375', width: 375, height: 812 }, { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 }, { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 }, { name: '1440', width: 1440, height: 900 },
] as const

test.beforeAll(async () => { await mkdir(artifacts, { recursive: true }); await mkdir(experiencesArtifacts, { recursive: true }) })
test.beforeEach(async ({ page }) => { await page.goto('/'); await clearPersonalState(page) })

test('smoke de Home, catálogo y rutas principales', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Tomorrowland/i, level: 1 })).toBeVisible()
  await waitForHomeData(page)
  await expect(page.getByText('Próximo hito', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.events-calendar-disclosure')).not.toHaveAttribute('open', '')
  await expect(page.getByRole('heading', { name: /Información importante/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Qué opción te conviene/i })).toBeVisible()
  await page.goto('/planes/1-persona'); await expect(page.locator('article.plan-card')).toHaveCount(2)
  await page.goto('/planes/2-personas'); await expect(page.locator('article.plan-card')).toHaveCount(5)
  const derived = card(page, '2 × Full Madness Pass')
  await expect(derived).toContainText('Cálculo para 2 personas')
  await expect(derived).toContainText('2 entradas individuales · no es un pack oficial 2P')
  await expect(derived).toContainText('Precio estimado')
  await page.goto('/comparar'); await expect(page.getByRole('heading', { name: /Elige los planes/i })).toBeVisible()
})

test('Easy Tent cambia Regular, Comfort y N°1 y recalcula presupuesto', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openPlan(page, 'Easy Tent 2P')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.locator('.tier-price').getByText('R$ 7.609', { exact: true })).toBeVisible()
  await expectElementNoOverflow(dialog)
  const initialBudget = await budgetTotal(dialog)
  await dialog.getByRole('button', { name: 'Comfort' }).click()
  await expect(dialog.locator('.tier-price').getByText('R$ 12.359', { exact: true })).toBeVisible()
  await expect(dialog.locator('.tier-price').getByText(/\+ R\$ 4\.750 .* vs\. Regular/)).toBeVisible()
  expect(await budgetTotal(dialog)).not.toBe(initialBudget)
  await expectNoOverflow(page); await expectElementNoOverflow(dialog); await expectElementAtHorizontalOrigin(dialog); await expectPageAtHorizontalOrigin(page); await page.screenshot({ path: `${artifacts}/easy-tent-comfort-390.png` })
  await dialog.getByRole('button', { name: 'N°1' }).click()
  await expect(dialog.locator('.tier-price').getByText('R$ 20.719', { exact: true })).toBeVisible()
  await expect(dialog.locator('.tier-key-benefits').getByText(/Acceso a todas las áreas Comfort/).first()).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Ver en Tomorrowland/ })).toBeVisible()
  await expectNoOverflow(page); await expectElementNoOverflow(dialog); await expectElementAtHorizontalOrigin(dialog); await expectPageAtHorizontalOrigin(page); await page.screenshot({ path: `${artifacts}/easy-tent-number-one-390.png` })
  await dialog.getByRole('button', { name: 'Regular' }).click()
  await expectElementNoOverflow(dialog); await page.screenshot({ path: `${artifacts}/easy-tent-regular-390.png` })
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click(); await expect(dialog).toBeHidden()
})

test('Mi Viaje persiste modalidad y BudgetPreferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openPlan(page, 'Easy Tent 2P')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Comfort' }).click()
  await dialog.getByRole('button', { name: 'Elegir como mi plan' }).click()
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click(); await page.goto('/')
  await expect(page.locator('.my-trip-section').getByText('Easy Tent 2P', { exact: true })).toBeVisible()
  await expect(page.locator('.my-trip-section').getByText(/Modalidad para planificar:/)).toContainText('Comfort')
  await expect(page.locator('.my-trip-disclosure').first()).not.toHaveAttribute('open', '')
  await expect(page.locator('.trip-preparation details')).not.toHaveAttribute('open', '')
  await expect(page.locator('.my-trip-disclosure').last()).not.toHaveAttribute('open', '')
  await page.reload(); await expect(page.locator('.my-trip-section').getByText(/Modalidad para planificar:/)).toContainText('Comfort')
  await page.screenshot({ path: `${artifacts}/ux-phase-2-final-home-mytrip-390.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 }); await expectNoOverflow(page)
  await page.screenshot({ path: `${artifacts}/ux-phase-2-final-home-mytrip-1440.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Ajustar presupuesto' }).click()
  const budgetDialog = page.getByRole('dialog'); const flight = budgetDialog.getByLabel('Vuelo')
  const before = await budgetTotal(budgetDialog); await flight.fill('520000')
  await expect(budgetDialog.getByText('Presupuesto personalizado')).toBeVisible(); expect(await budgetTotal(budgetDialog)).not.toBe(before)
  await budgetDialog.getByRole('button', { name: 'Restablecer estimaciones' }).click(); await expect(flight).toHaveValue('400000')
})

test('Mi Preparación conserva gastos solo en el navegador', async ({ page }) => {
  await selectMyPlan(page, 'Easy Tent 2P')
  const outgoing: string[] = []; page.on('request', (request) => { if (request.method() !== 'GET') outgoing.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`) })
  const preparation = page.locator('.trip-preparation'); await preparation.locator('summary').click(); const documentation = preparation.locator('li').filter({ hasText: 'Revisar documentación' }).getByRole('checkbox')
  await documentation.check(); await expect(documentation).toBeChecked(); await documentation.uncheck()
  const flightRow = preparation.locator('li').filter({ hasText: 'Comprar vuelos' })
  await flightRow.getByRole('button', { name: 'Registrar gasto' }).click(); await flightRow.getByLabel('Monto pagado en CLP').fill('365000'); await flightRow.getByRole('button', { name: 'Guardar gasto' }).click()
  await expect(flightRow).toContainText('Pagado: $365.000 por persona')
  await flightRow.getByRole('button', { name: 'Editar gasto' }).click(); await flightRow.getByLabel('Monto pagado en CLP').fill('370000'); await flightRow.getByRole('button', { name: 'Guardar cambios' }).click()
  await flightRow.getByRole('button', { name: 'Eliminar gasto' }).click(); await expect(flightRow).toContainText('Gasto no registrado')
  expect(outgoing.some((entry) => entry.includes('365000') || entry.includes('370000'))).toBe(false)
})

test('comparador funciona en mobile y desktop', async ({ page }) => {
  await page.goto('/planes/2-personas')
  await card(page, '2 × Full Madness Pass').getByRole('button', { name: 'Comparar' }).click(); await card(page, 'Easy Tent 2P').getByRole('button', { name: 'Comparar' }).click()
  await page.locator('.comparison-bar').getByRole('link', { name: /Comparar/ }).click()
  await expect(page.getByText('2 × Full Madness Pass', { exact: true }).first()).toBeVisible(); await expect(page.getByText('Easy Tent 2P', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Solo diferencias' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Viaje estimado por persona' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 }); await expectNoOverflow(page); await page.screenshot({ path: `${artifacts}/compare-390.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 }); await expectNoOverflow(page); await page.screenshot({ path: `${artifacts}/compare-1440.png`, fullPage: true })
  await page.getByRole('button', { name: 'Ver todo' }).click(); await expect(page.getByRole('heading', { name: 'Incluye', exact: true })).toBeVisible()
})

test('seis viewports no presentan overflow y generan capturas', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/'); await waitForHomeData(page); await expect(page.getByText('Próximo hito', { exact: true }).first()).toBeVisible()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await expectNoOverflow(page)
    if (viewport.name === '390' || viewport.name === '1440') await page.screenshot({ path: `${artifacts}/ux-phase-2-final-home-new-user-${viewport.name}.png`, fullPage: true })
  }
  await page.goto('/planes/2-personas'); await expect(page.locator('article.plan-card').first()).toBeVisible()
  await expect(page.locator('.decision-clp').nth(1)).toContainText(/≈ \$/)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await expectNoOverflow(page)
    if (viewport.name === '390' || viewport.name === '1440') await page.screenshot({ path: `${artifacts}/plans-2p-${viewport.name}.png`, fullPage: true })
  }
})

test('dialog soporta Escape, foco y controles accesibles', async ({ page }) => {
  await page.goto('/planes/2-personas'); const trigger = card(page, 'Easy Tent 2P').getByRole('button', { name: 'Ver plan' })
  await trigger.focus(); await trigger.press('Enter'); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused()
})

test('Experiencias navega, atribuye fuentes y filtra contenido real', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'Experiencias', exact: true }).click()
  await expect(page).toHaveURL(/\/experiencias$/)
  await expect(page.getByRole('link', { name: 'Experiencias', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('heading', { name: 'Experiencias', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tomorrowland Brasil 2025 | Aftermovie' })).toBeVisible()
  await expect(page.getByText('Contenido oficial').first()).toBeVisible()
  await expect(page.getByText('Experiencia personal').first()).toBeVisible()
  const officialLink = page.getByRole('link', { name: 'Ver video' }).first()
  await expect(officialLink).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/)
  await expect(officialLink).toHaveAttribute('target', '_blank')
  await expect(officialLink).toHaveAttribute('rel', /noopener/)
  const arrival = page.getByRole('button', { name: 'Llegada' })
  await arrival.focus(); await expect(arrival).toBeFocused(); await arrival.press('Enter')
  await expect(arrival).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('2 experiencias', { exact: true })).toBeVisible()
  await expect(page.locator('article.experience-card')).toHaveCount(2)
  await expectNoOverflow(page)
  await page.screenshot({ path: `${experiencesArtifacts}/experiences-filter-390.png`, fullPage: true })
})

test('Experiencias y el header no presentan overflow en seis viewports', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/experiencias')
  await expect(page.getByRole('heading', { name: 'Experiencias', level: 1 })).toBeVisible()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expectNoOverflow(page)
    await expectElementNoOverflow(page.locator('.site-header'))
    await expect(page.getByRole('link', { name: 'WebTomorrowland, inicio' })).toBeVisible()
    await expect(page.locator('.compare-nav span')).toBeVisible()
    if (viewport.name === '390' || viewport.name === '1440') {
      await page.screenshot({ path: `${experiencesArtifacts}/experiences-${viewport.name}.png`, fullPage: true })
      await page.screenshot({ path: `${experiencesArtifacts}/header-with-experiences-${viewport.name}.png`, clip: { x: 0, y: 0, width: viewport.width, height: 90 } })
      if (viewport.name === '390') await page.screenshot({ path: `${experiencesArtifacts}/experiences-above-fold-390.png` })
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expectNoOverflow(page)
  await page.screenshot({ path: `${experiencesArtifacts}/home-with-experiences-header-390.png`, clip: { x: 0, y: 0, width: 390, height: 90 } })
})

function card(page: Page, name: string) { return page.locator('article.plan-card').filter({ has: page.getByRole('heading', { name, exact: true }) }) }
async function openPlan(page: Page, name: string) { await page.goto('/planes/2-personas'); await card(page, name).getByRole('button', { name: 'Ver plan' }).click(); await expect(page.getByRole('dialog')).toBeVisible() }
async function selectMyPlan(page: Page, name: string) { await openPlan(page, name); await page.getByRole('dialog').getByRole('button', { name: 'Elegir como mi plan' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar detalle' }).click(); await page.goto('/') }
async function budgetTotal(scope: Locator) { return scope.locator('.detail-trip-summary .budget-summary strong').innerText() }
async function expectNoOverflow(page: Page) { const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1) }
async function expectElementNoOverflow(locator: Locator) { const dimensions = await locator.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth })); expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1) }
async function expectElementAtHorizontalOrigin(locator: Locator) { expect(await locator.evaluate((element) => element.scrollLeft)).toBe(0) }
async function expectPageAtHorizontalOrigin(page: Page) { expect(await page.evaluate(() => window.scrollX)).toBe(0) }
async function clearPersonalState(page: Page) { await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('webtomorrowland:')) localStorage.removeItem(key) }); await page.reload() }
async function waitForHomeData(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.getByText('Próximo hito', { exact: true }).count()) return
    await page.waitForTimeout(1500); await page.reload()
  }
}
