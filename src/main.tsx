import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { SelectionProvider } from './state/SelectionContext'
import { BudgetPreferencesProvider } from './state/BudgetPreferencesContext'
import './styles.css'
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><BudgetPreferencesProvider><SelectionProvider><App /></SelectionProvider></BudgetPreferencesProvider></BrowserRouter></StrictMode>)
