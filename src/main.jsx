import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from './lib/api.js'
import './index.css'
import App from './App.jsx'

window.api = api

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
