import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './lib/i18n'
import './styles/globals.css'
import './styles/components.css'

// Initialize lite mode from localStorage
if (localStorage.getItem('liteMode') === 'true') {
  document.documentElement.classList.add('lite-mode')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
