import type { PlanSource, TravelPlan } from '../src/models/plan'

const verifiedAt = '2026-08-20'
const event = { startsOn: '2027-04-30', endsOn: '2027-05-02', venue: 'Parque Maeda', location: 'Itu, São Paulo, Brasil' }

function officialSource(label: string, url: string): PlanSource {
  return { label, url, type: 'OFFICIAL', verifiedAt, updatedAt: verifiedAt }
}

const eventSource = officialSource(
  'Tomorrowland Brasil 2027 · información general',
  'https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/',
)
const ticketSource = officialSource(
  'Tomorrowland Brasil · Festival Tickets',
  'https://brasil.tomorrowland.com/en/tickets/festival-tickets/',
)
const hotelSource = officialSource(
  'Tomorrowland Brasil · Global Journey Hotel Packages',
  'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/',
)
const easyTentSource = officialSource(
  'Tomorrowland Brasil · Easy Tent 2P',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/',
)
const spectacularSource = officialSource(
  'Tomorrowland Brasil · Spectacular Easy Tent 2P',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package/',
)
const vidaNovaSource = officialSource(
  'Tomorrowland Brasil · Vida Nova 2P',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package/',
)

const noCamping = { required: false, equipmentProvided: true, provider: 'NOT_APPLICABLE' as const }
const providedCamping = { required: true, equipmentProvided: true, provider: 'TOMORROWLAND' as const }
const common = { event, status: 'COMING_SOON' as const, updatedAt: verifiedAt }

function globalJourneyHotel(travelerCount: 1 | 2): TravelPlan {
  return {
    ...common,
    id: `global-journey-hotel-${travelerCount}p-2027`,
    name: `Global Journey Hotel · ${travelerCount} ${travelerCount === 1 ? 'persona' : 'personas'}`,
    travelerCount,
    category: 'GLOBAL_JOURNEY',
    accommodation: 'Hotel seleccionado por Tomorrowland en Itu, Sorocaba o Alphaville; categoría y habitación sujetas a disponibilidad',
    transport: 'Traslados diarios hotel ↔ festival incluidos; transporte adicional depende de la configuración elegida',
    festivalPass: `Full Madness Pass para ${travelerCount} ${travelerCount === 1 ? 'persona' : 'personas'}`,
    dreamVilleIncluded: false,
    camping: noCamping,
    totalPrice: null,
    priceType: null,
    inclusions: ['Acceso a todos los días del festival', 'Hotel seleccionado', 'Traslados hotel ↔ festival', 'The Gathering', 'Souvenir Bag', 'Treasure Case'],
    notIncluded: ['Precio aún no publicado', 'Transporte hasta el punto inicial, salvo que se elija como parte del paquete', 'Posibles tasas de entrega o importación'],
    sources: [hotelSource, eventSource],
  }
}

export const productionPlans: TravelPlan[] = [
  {
    ...common,
    id: 'full-madness-1p-2027',
    name: 'Full Madness Pass · 1 persona',
    travelerCount: 1,
    category: 'SEPARATE_PURCHASE',
    accommodation: 'No incluido',
    transport: 'No incluido',
    festivalPass: 'Full Madness Pass (viernes, sábado y domingo)',
    dreamVilleIncluded: false,
    camping: noCamping,
    totalPrice: { amount: 3160, currency: 'BRL' },
    priceType: 'OFFICIAL',
    inclusions: ['Acceso general a los tres días de Tomorrowland Brasil 2027'],
    notIncluded: ['Alojamiento', 'Transporte', 'Envío del Treasure Case y posibles tasas de importación'],
    sources: [ticketSource, eventSource],
  },
  globalJourneyHotel(1),
  {
    ...common,
    id: 'full-madness-2p-2027',
    name: 'Full Madness Pass · 2 personas',
    travelerCount: 2,
    category: 'SEPARATE_PURCHASE',
    accommodation: 'No incluido',
    transport: 'No incluido',
    festivalPass: '2 Full Madness Pass (viernes, sábado y domingo)',
    dreamVilleIncluded: false,
    camping: noCamping,
    totalPrice: { amount: 6320, currency: 'BRL' },
    priceType: 'ESTIMATED',
    inclusions: ['Acceso general para dos personas durante los tres días'],
    notIncluded: ['Alojamiento', 'Transporte', 'Envío del Treasure Case y posibles tasas de importación'],
    sources: [ticketSource, eventSource],
  },
  {
    ...common,
    id: 'vida-nova-2p-2027',
    name: 'Vida Nova 2P',
    travelerCount: 2,
    category: 'SEPARATE_PURCHASE',
    accommodation: 'Carpa Tomorrowland preinstalada con colchón inflable doble',
    transport: 'No incluido',
    festivalPass: '2 accesos para todos los días del festival',
    dreamVilleIncluded: true,
    camping: providedCamping,
    totalPrice: { amount: 7009, currency: 'BRL' },
    priceType: 'OFFICIAL',
    inclusions: ['Carpa preinstalada', 'Colchón inflable doble', 'Magnificent Greens Area', 'The Gathering', 'Marketplace', 'Balance Yard'],
    notIncluded: ['Transporte', 'Sacos de dormir no informados como incluidos', 'Envío del Treasure Case y posibles tasas de importación'],
    sources: [vidaNovaSource, eventSource],
  },
  {
    ...common,
    id: 'easy-tent-2p-2027',
    name: 'Easy Tent 2P',
    travelerCount: 2,
    category: 'SEPARATE_PURCHASE',
    accommodation: 'Easy Tent preinstalada y equipada para 2 personas',
    transport: 'No incluido',
    festivalPass: '2 accesos para todos los días del festival',
    dreamVilleIncluded: true,
    camping: providedCamping,
    totalPrice: { amount: 7609, currency: 'BRL' },
    priceType: 'OFFICIAL',
    inclusions: ['Easy Tent', 'Colchón inflable doble', '2 sacos de dormir', 'Luz nocturna', 'Espejo', 'Candado', 'The Gathering', 'Marketplace', 'Balance Yard'],
    notIncluded: ['Transporte', 'Envío del Treasure Case y posibles tasas de importación'],
    sources: [easyTentSource, eventSource],
  },
  {
    ...common,
    id: 'spectacular-easy-tent-2p-2027',
    name: 'Spectacular Easy Tent 2P',
    travelerCount: 2,
    category: 'SEPARATE_PURCHASE',
    accommodation: 'Spectacular Easy Tent preinstalada y equipada para 2 personas',
    transport: 'No incluido',
    festivalPass: '2 accesos para todos los días del festival',
    dreamVilleIncluded: true,
    camping: providedCamping,
    totalPrice: { amount: 8359, currency: 'BRL' },
    priceType: 'OFFICIAL',
    inclusions: ['Easy Tent edición limitada', 'Colchón inflable doble', '2 sacos de dormir', 'Almohada', 'Luz, espejo y candado', 'Toma eléctrica 220 V estándar BR', 'The Gathering', 'Marketplace', 'Balance Yard'],
    notIncluded: ['Transporte', 'Envío del Treasure Case y posibles tasas de importación'],
    sources: [spectacularSource, eventSource],
  },
  globalJourneyHotel(2),
]
