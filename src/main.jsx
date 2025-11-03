import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'

import 'bootstrap/dist/css/bootstrap.min.css'
import './app.css'

import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Local API init (seeding is a no-op if already done)
import { initLocalApi } from './data/api.local.js'

const container = document.getElementById('root')
const root = createRoot(container)

initLocalApi()
  .catch(err => {
    console.error('Local API init failed:', err)
  })
  .finally(() => {
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    )
  })
