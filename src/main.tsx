import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCloud } from './cloud/cloud'
import { guardAgainstAutofill } from './components/noAutofill'
import { resumeIndexing } from './db/books'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Finish extracting rulebook text if a previous session was closed mid-way.
void resumeIndexing()

// Google Drive sync, if this build has a Google client ID.
initCloud()

// Keep password managers from offering logins and identities in character fields.
guardAgainstAutofill()
