import { ArrowUpRight, CreditCard, Gift, Info, Ticket, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ImportantInformation, ImportantInformationCategory } from '../models/importantInformation'
import { useImportantInformation } from '../hooks/useImportantInformation'
import { formatDate } from '../utils/format'

const icons: Partial<Record<ImportantInformationCategory, typeof Info>> = {
  TREASURE_CASE: Gift, WRISTBANDS: Ticket, TICKETS: Ticket, PAYMENT_INFORMATION: CreditCard,
}

export function ImportantInformationSection() {
  const { items, loading } = useImportantInformation()
  const [selected, setSelected] = useState<ImportantInformation | null>(null)
  if (loading || items.length === 0) return null
  const highlighted = items.filter((item) => item.highlighted)
  const preview = highlighted.slice(0, 2)
  const remaining = highlighted.slice(2)
  const renderCard = (item: ImportantInformation) => { const Icon = icons[item.category] ?? Info; return <article key={item.id} className="information-card"><Icon aria-hidden="true" /><h3>{item.title}</h3><p>{item.summary}</p><button className="text-button" type="button" onClick={() => setSelected(item)}>Ver información</button></article> }
  return <section className="important-information" aria-labelledby="important-information-title">
    <div className="section-intro"><p className="eyebrow">Antes de revisar la venta oficial</p><h2 id="important-information-title">Información importante</h2><p>Condiciones oficiales que conviene conocer al planificar tu experiencia.</p></div>
    <div className="information-grid">{preview.map(renderCard)}</div>
    {remaining.length > 0 && <details className="information-disclosure"><summary>Ver toda la información</summary><div className="information-grid">{remaining.map(renderCard)}</div></details>}
    {selected && <InformationDialog item={selected} onClose={() => setSelected(null)} />}
  </section>
}

function InformationDialog({ item, onClose }: { item: ImportantInformation; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  return <dialog ref={(node) => { ref.current = node; if (node && !node.open) node.showModal() }} className="information-dialog" onCancel={(event) => { event.preventDefault(); onClose() }} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="information-dialog-title"><article>
    <button type="button" className="detail-close" onClick={onClose} aria-label="Cerrar información"><X aria-hidden="true" /></button>
    <p className="eyebrow">Información oficial</p><h2 id="information-dialog-title">{item.title}</h2><p>{item.summary}</p>
    <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
    <p className="information-trace">Observado el {formatDate(item.sourceObservedAt.slice(0, 10))} · {item.sourceName}</p>
    <a className="button secondary" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Ver información oficial <ArrowUpRight aria-hidden="true" /></a>
  </article></dialog>
}
