import React from 'react'
import { Outlet, Link } from 'react-router-dom'

function App() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800">
      {/* Top bar similar to flow minimal */}
      <div className="sticky top-0 z-50 h-12 bg-white/90 backdrop-blur border-b border-black/10 flex items-center px-4">
        <Link to="/" className="font-semibold">简阅 · EPUB</Link>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Outlet />
      </div>
    </div>
  )
}

export default App
