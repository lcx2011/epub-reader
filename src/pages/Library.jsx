import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Library() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/epubs/index.json?_=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('加载清单失败')
        return r.json()
      })
      .then(data => setBooks(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-10 text-center text-neutral-500">加载中...</div>
  }

  if (error) {
    return <div className="text-red-600">{error}</div>
  }

  if (!books.length) {
    return <div className="text-neutral-500">尚无书籍。请把 .epub 放入 public/epubs/ 并更新 index.json。</div>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {books.map(b => (
        <Link key={b.slug} to={`/read/${encodeURIComponent(b.slug)}`} className="group block">
          <div className="hover-card">
            <div className="ratio-3x4 book-cover flex items-center justify-center">
              <span className="text-neutral-400 text-sm px-2 text-center leading-snug">
                {b.title?.slice(0, 30) || '未命名'}
              </span>
            </div>
            <div className="px-2 py-2">
              <div className="text-sm font-medium text-neutral-900 truncate">{b.title || '未命名'}</div>
              <div className="text-xs text-neutral-500 truncate">{b.author || '佚名'}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
