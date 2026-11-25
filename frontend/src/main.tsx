import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageHeader } from './components/PageHeader'
import './styles.css'

function Placeholder({ title }: { title: string }) {
  return <><PageHeader title={title} description="This workspace is ready for the connected module." /><div className="card empty">Select a module from the navigation to continue.</div></>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />} />
        <Route path="*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
