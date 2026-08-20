import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'

export function HomePage() {
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">Tomorrowland Brasil · 2027</p><h1>Tu viaje empieza con una comparación clara.</h1><p className="hero-lead">Explora alternativas de paquete y compra separada, entiende qué incluye cada una y compara costos sin confundir estimaciones con precios oficiales.</p><div className="hero-actions"><Link className="button" to="/planes/1-persona">Explorar plan 1 persona</Link><Link className="button secondary" to="/planes/2-personas">Explorar plan 2 personas</Link></div><p className="disclaimer">Información demo para planificar. Ningún valor mostrado es todavía un precio oficial de 2027.</p></div>
      <div className="hero-art" aria-hidden="true"><div className="sun"><BrandMark /></div><div className="land land-one" /><div className="land land-two" /><div className="path" /></div>
    </section>
    <section className="how-it-works"><p className="eyebrow">Simple por diseño</p><h2>De la idea a una decisión informada</h2><div className="steps"><article><span>01</span><h3>Elige modalidad</h3><p>Revisa opciones para una o dos personas bajo el mismo modelo.</p></article><article><span>02</span><h3>Selecciona alternativas</h3><p>Marca hasta tres opciones que quieras revisar en detalle.</p></article><article><span>03</span><h3>Compara lado a lado</h3><p>Contrasta precios, transporte, alojamiento e inclusiones.</p></article></div></section>
  </>
}
