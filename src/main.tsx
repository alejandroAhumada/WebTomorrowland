import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { SelectionProvider } from './state/SelectionContext'
import './styles.css'
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><SelectionProvider><App /></SelectionProvider></BrowserRouter></StrictMode>)
