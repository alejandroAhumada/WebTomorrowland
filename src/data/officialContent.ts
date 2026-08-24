import type { TicketTier, TicketTierOffering } from '../models/ticketTier'
import type { ImportantInformation } from '../models/importantInformation'

const observedAt = '2026-08-23T00:00:00.000Z'
const updatedAt = '2026-08-23'
const festivalTickets = 'https://brasil.tomorrowland.com/en/tickets/festival-tickets/'
const easyTent = 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/'
const spectacular = 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package/'
const vidaNova = 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package/'
const globalJourney = 'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/'
const howToOrder = 'https://brasil.tomorrowland.com/en/sales/how-to-order-your-tickets/'

function offering(planId: string, sourceUrl: string, amount: number | null, available = true): TicketTierOffering {
  return { planId, available, totalPrice: amount === null ? null : { amount, currency: 'BRL' }, priceType: amount === null ? null : 'OFFICIAL', sourceUrl }
}

const planOfferings = (amounts: { full1: number; vida: number; easy: number; spectacular: number }): TicketTierOffering[] => [
  offering('full-madness-1p-2027', festivalTickets, amounts.full1),
  offering('full-madness-2p-2027', festivalTickets, null, false),
  offering('vida-nova-2p-2027', vidaNova, amounts.vida),
  offering('easy-tent-2p-2027', easyTent, amounts.easy),
  offering('spectacular-easy-tent-2p-2027', spectacular, amounts.spectacular),
  offering('global-journey-hotel-1p-2027', globalJourney, null),
  offering('global-journey-hotel-2p-2027', globalJourney, null),
]

export const initialTicketTiers: TicketTier[] = [
  {
    id: 'regular', type: 'REGULAR', name: 'Regular',
    description: 'Acceso general al festival según el producto o paquete seleccionado.',
    benefits: ['Acceso general a Tomorrowland Brasil durante la vigencia del pase incluido.'],
    conditions: ['No incluye acceso a las áreas Comfort ni al área N°1.'],
    offerings: planOfferings({ full1: 3160, vida: 7009, easy: 7609, spectacular: 8359 }),
    sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt, updatedAt,
  },
  {
    id: 'comfort', type: 'COMFORT', name: 'Comfort',
    description: 'Añade acceso a todas las áreas Comfort del festival.',
    benefits: [
      'Vistas privilegiadas y terrazas cubiertas en las áreas Comfort.',
      'Servicio de mesa, personal dedicado y bares exclusivos.',
      'En el área Comfort del MainStage, experiencia gastronómica por etapas con entrada, plato principal y postre.',
      'Welcome Drink de cortesía en el área Comfort del MainStage entre 13:00 y 15:00.',
    ],
    conditions: ['Los beneficios corresponden a las áreas Comfort y están sujetos a las condiciones oficiales del festival.'],
    offerings: planOfferings({ full1: 5535, vida: 11759, easy: 12359, spectacular: 13109 }),
    sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt, updatedAt,
  },
  {
    id: 'number-one', type: 'NUMBER_ONE', name: 'N°1',
    description: 'Incluye las áreas Comfort y acceso al área exclusiva N°1 frente al MainStage Consciencia.',
    benefits: [
      'Acceso a todas las áreas Comfort y al área N°1 frente al MainStage Consciencia.',
      'Servicio de shuttle desde São Paulo o Itu hasta la entrada exclusiva del festival.',
      'Bebidas all-inclusive.',
      'Opciones de alimentación incluidas.',
    ],
    conditions: ['El shuttle opera desde São Paulo o Itu hacia la entrada exclusiva; la fuente no publica horarios en esta página.'],
    offerings: planOfferings({ full1: 9715, vida: 20119, easy: 20719, spectacular: 21469 }),
    sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt, updatedAt,
  },
]

export const initialImportantInformation: ImportantInformation[] = [
  {
    id: 'treasure-case-delivery-2027', title: 'Treasure Case y Home Delivery',
    summary: 'Home Delivery seleccionado hasta el 24 de octubre incluye Treasure Case; después, las pulseras se envían en un sobre personalizado.',
    details: ['Se proporciona una Treasure Case por cada dos pulseras con Home Delivery.', 'Las tarifas de envío varían según el destino.', 'Después del 24 de octubre, las pulseras se entregan en un sobre personalizado.'],
    category: 'TREASURE_CASE', sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt,
    effectiveUntil: '2026-10-24', priority: 100, highlighted: true, appliesTo: { scope: 'ALL' },
    relatedEventId: 'treasure-case-home-delivery-deadline-2027', updatedAt,
  },
  {
    id: 'treasure-case-availability-2027', title: 'Disponibilidad de Treasure Case',
    summary: 'Tomorrowland indica que se envía una Treasure Case por cada dos pulseras, sujeta a disponibilidad.',
    details: ['La condición de disponibilidad está publicada en la guía oficial de pedido.', 'Los paquetes no incluyen las tarifas de entrega, que se aplican según la dirección seleccionada.'],
    category: 'TREASURE_CASE', sourceName: 'Tomorrowland Brasil', sourceUrl: howToOrder, sourceObservedAt: observedAt,
    priority: 75, highlighted: false, appliesTo: { scope: 'ALL' }, updatedAt,
  },
  {
    id: 'festival-wristband-pickup-2027', title: 'Retiro de pulsera en el festival',
    summary: 'Tomorrowland permite retirar gratuitamente la pulsera en la boletería del festival.',
    details: ['El retiro en el festival es gratuito.', 'El retiro en el festival no incluye Treasure Case.'],
    category: 'WRISTBANDS', sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt,
    priority: 85, highlighted: true, appliesTo: { scope: 'ALL' }, updatedAt,
  },
  {
    id: 'festival-ticket-tiers-2027', title: 'Modalidades Regular, Comfort y N°1',
    summary: 'Los productos compatibles pueden ofrecer acceso Regular, Comfort o N°1 con beneficios y precios diferentes.',
    details: ['Comfort añade acceso a áreas Comfort.', 'N°1 incluye las áreas Comfort y el área exclusiva N°1.', 'La disponibilidad y el precio deben revisarse para cada producto; no todas las variantes tienen precio publicado.'],
    category: 'TICKETS', sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt,
    priority: 90, highlighted: true, appliesTo: { scope: 'ALL' }, updatedAt,
  },
  {
    id: 'festival-payment-conditions-2027', title: 'Condiciones de pago oficiales',
    summary: 'Tomorrowland publica medios y condiciones de pago aplicables a la venta oficial.',
    details: ['Se aceptan tarjetas Mastercard, Visa y Elo, Google Pay y Pix; no se aceptan tarjetas corporativas.', 'Para personas con CPF brasileño, se publican hasta 3 cuotas sin interés y entre 4 y 10 cuotas con interés.'],
    category: 'PAYMENT_INFORMATION', sourceName: 'Tomorrowland Brasil', sourceUrl: festivalTickets, sourceObservedAt: observedAt,
    priority: 70, highlighted: false, appliesTo: { scope: 'ALL' }, updatedAt,
  },
]
