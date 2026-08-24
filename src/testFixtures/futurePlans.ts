/**
 * Synthetic compatibility fixtures. They do not represent real Tomorrowland products.
 * Their only purpose is to prove that unfamiliar official data fails safely.
 */

const observedOn = '2026-08-24'
const officialFixtureSource = {
  label: '[FIXTURE] Fuente oficial genérica; producto ficticio',
  type: 'OFFICIAL' as const,
  url: 'https://brasil.tomorrowland.com/en/tickets/',
  verifiedAt: observedOn,
  updatedAt: observedOn,
}
const event = {
  startsOn: '2027-04-30', endsOn: '2027-05-02', venue: 'Parque Maeda', location: 'Itu, São Paulo, Brasil',
}

const unknownBase = {
  name: '[FIXTURE] Future official package — not a real product',
  travelerCount: 2,
  category: 'FUTURE_OFFICIAL_PACKAGE',
  event,
  accommodation: 'No informado',
  transport: 'No informado',
  festivalPass: 'No informado',
  totalPrice: null,
  priceType: null,
  inclusions: [],
  notIncluded: [],
  status: 'COMING_SOON',
  sources: [officialFixtureSource],
  updatedAt: observedOn,
}

export const futurePlanFixtures = {
  NEW_UNKNOWN_CATEGORY: { ...unknownBase },
  NEW_DREAMVILLE_PARTIAL: { ...unknownBase, category: 'FUTURE_DREAMVILLE_FAMILY', dreamVilleIncluded: true },
  NEW_GLOBAL_JOURNEY_PARTIAL: { ...unknownBase, category: 'GLOBAL_JOURNEY' },
  NEW_PRODUCT_PENDING_PRICE: { ...unknownBase, totalPrice: null, priceType: null },
  NEW_PRODUCT_UNKNOWN_ACCOMMODATION: { ...unknownBase, accommodationIncluded: null },
  NEW_PRODUCT_NO_TIERS: { ...unknownBase },
  NEW_PRODUCT_NEW_TIER_UNSUPPORTED: { ...unknownBase, ticketTiers: ['FUTURE_TIER'] },
  FUTURE_PRODUCT_WITH_EXTRA_FIELD: { ...unknownBase, futureOfficialField: { label: 'Información futura preservada en el dato crudo' } },
  FUTURE_PRODUCT_MISSING_OPTIONAL_FIELD: {
    name: unknownBase.name,
    travelerCount: unknownBase.travelerCount,
    category: unknownBase.category,
    event,
    totalPrice: null,
    priceType: null,
    inclusions: [],
    notIncluded: [],
    status: unknownBase.status,
    sources: unknownBase.sources,
    updatedAt: unknownBase.updatedAt,
  },
} as const

