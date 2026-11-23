import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function Bootstrap() {
  return <div>BlueMoon Apartment Management</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
)
