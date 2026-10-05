import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resumeIndexing } from './db/books'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Finish extracting rulebook text if a previous session was closed mid-way.
void resumeIndexing()
