import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // 👈 THIS WAS MISSING! THIS LOADS TAILWIND.
import './utils/httpCache'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)