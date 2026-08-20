import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ComparePage } from './pages/ComparePage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlansPage } from './pages/PlansPage'
export function App() { return <Routes><Route element={<Layout />}><Route index element={<HomePage />} /><Route path="planes/1-persona" element={<PlansPage travelerCount={1} />} /><Route path="planes/2-personas" element={<PlansPage travelerCount={2} />} /><Route path="planes" element={<Navigate to="/planes/1-persona" replace />} /><Route path="comparar" element={<ComparePage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes> }
