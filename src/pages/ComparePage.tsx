import { Link } from 'react-router-dom'
import { PriceBadge } from '../components/PriceBadge'
import { ClpConversion } from '../components/ClpConversion'
import { usePlans } from '../hooks/usePlans'
import { getPricePerPerson } from '../models/plan'
import { useSelection } from '../state/useSelection'
import { formatMoney, statusLabels } from '../utils/format'

export function ComparePage() {
  const { selectedIds, toggle, clear } = useSelection()
  const { plans, loading, error } = usePlans(undefined, selectedIds)
  if (selectedIds.length === 0) return <div className="page-container empty-state"><p className="eyebrow">Comparador</p><h1>Aún no seleccionaste alternativas</h1><p>Elige hasta tres planes para contrastar sus detalles lado a lado.</p><div><Link className="button" to="/planes/1-persona">Ver plan 1 persona</Link><Link className="button secondary" to="/planes/2-personas">Ver plan 2 personas</Link></div></div>
  return <div className="page-container compare-page"><div className="page-heading"><div><p className="eyebrow">Comparador</p><h1>{selectedIds.length} alternativas lado a lado</h1><p>Desliza horizontalmente en móvil para revisar todas las columnas.</p></div><button className="text-button" type="button" onClick={clear}>Limpiar selección</button></div>
    {loading && <p className="notice">Preparando comparación…</p>}{error && <p className="notice error">{error}</p>}
    {!loading && !error && <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">Detalle</th>{plans.map((plan) => <th scope="col" key={plan.id}><span>{plan.name}</span><button type="button" onClick={() => toggle(plan.id)} aria-label={`Quitar ${plan.name}`}>Quitar</button></th>)}</tr></thead><tbody>
      <Row label="Precio total" plans={plans} render={(plan) => plan.totalPrice ? <><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} compact /></> : 'Pendiente de publicación'} />
      <Row label="Por persona" plans={plans} render={(plan) => { const price = getPricePerPerson(plan); return price ? formatMoney(price) : 'Pendiente' }} />
      <Row label="Alojamiento" plans={plans} render={(plan) => plan.accommodation} />
      <Row label="Transporte" plans={plans} render={(plan) => plan.transport} />
      <Row label="Festival / entrada" plans={plans} render={(plan) => plan.festivalPass} />
      <Row label="DreamVille" plans={plans} render={(plan) => plan.dreamVilleIncluded ? 'Incluido, equipamiento provisto' : 'No incluido'} />
      <Row label="Inclusiones" plans={plans} render={(plan) => <ul>{plan.inclusions.map((item) => <li key={item}>{item}</li>)}</ul>} />
      <Row label="No incluido" plans={plans} render={(plan) => plan.notIncluded.length ? <ul>{plan.notIncluded.map((item) => <li key={item}>{item}</li>)}</ul> : 'Sin exclusiones informadas'} />
      <Row label="Tipo de precio" plans={plans} render={(plan) => <PriceBadge type={plan.priceType} />} />
      <Row label="Disponibilidad" plans={plans} render={(plan) => statusLabels[plan.status]} />
    </tbody></table></div>}
  </div>
}

function Row({ label, plans, render, strong = false }: { label: string; plans: ReturnType<typeof usePlans>['plans']; render: (plan: ReturnType<typeof usePlans>['plans'][number]) => React.ReactNode; strong?: boolean }) {
  return <tr><th scope="row">{label}</th>{plans.map((plan) => <td key={plan.id}>{strong ? <strong>{render(plan)}</strong> : render(plan)}</td>)}</tr>
}
