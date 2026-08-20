import { Link } from 'react-router-dom'
export function NotFoundPage() { return <div className="page-container empty-state"><p className="eyebrow">Error 404</p><h1>Esta ruta no existe</h1><p>Vuelve al inicio para seguir explorando alternativas.</p><Link className="button" to="/">Ir al inicio</Link></div> }
