import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageHeader } from './components/PageHeader'
import './styles.css'

function Placeholder() {
  return <><PageHeader title="BlueMoon Apartment Management" description="Your operations workspace." /><div className="card empty">Select a module from the navigation to continue.</div></>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}><Route path="*" element={<Placeholder />} /></Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
