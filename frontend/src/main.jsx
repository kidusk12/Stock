import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './features/auth/AuthContext.jsx'
import '@fontsource/noto-sans-ethiopic/400.css'
import '@fontsource/noto-sans-ethiopic/500.css'
import '@fontsource/noto-sans-ethiopic/700.css'
import './i18n'
import { api } from './lib/api'

if (import.meta.env.DEV) window.api = api // dev only: lets you test from the console

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)