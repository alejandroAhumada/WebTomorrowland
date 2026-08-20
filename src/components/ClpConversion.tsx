import { useExchangeRate } from '../hooks/useExchangeRate'
import { convertMoney } from '../models/exchangeRate'
import type { Money } from '../models/plan'
import { formatDate, formatMoney } from '../utils/format'

export function ClpConversion({ money, compact = false }: { money: Money; compact?: boolean }) {
  if (money.currency === 'CLP') return null
  return <ForeignCurrencyConversion money={money} compact={compact} />
}

function ForeignCurrencyConversion({ money, compact }: { money: Money; compact: boolean }) {
  const { rate, loading, unavailable } = useExchangeRate(money.currency, 'CLP')
  const converted = convertMoney(money, 'CLP', rate)

  if (loading) return <span className="clp-conversion muted">Calculando referencia CLP…</span>
  if (unavailable || !rate || !converted) return <span className="clp-conversion muted">Conversión CLP no disponible</span>

  return <span className={`clp-conversion ${compact ? 'compact' : ''}`}>
    <strong>≈ {formatMoney(converted)} CLP</strong>
    <span>Conversión referencial</span>
    {!compact && <small>1 {rate.fromCurrency} ≈ {formatMoney({ amount: rate.rate, currency: 'CLP' })} CLP · actualizado {formatDate(rate.observedAt)} · <a href={rate.sourceUrl} target="_blank" rel="noreferrer">{rate.sourceName}</a></small>}
  </span>
}
