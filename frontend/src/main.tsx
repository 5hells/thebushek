import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />

    <img src="https://upload.wikimedia.org/wikipedia/en/thumb/5/50/Holy_Ghost_Preparatory_School_logo.svg/1200px-Holy_Ghost_Preparatory_School_logo.svg.png" alt="Holy Ghost Prep Logo" style={{ position: 'fixed', top: 10, left: 10, width: 100, opacity: 0.9, filter: 'brightness(1.2)' }} />

  </StrictMode>,
)
