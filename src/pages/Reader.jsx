import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// Use ready-made component from react-reader
import { EpubView } from 'react-reader'

export default function Reader() {
  const { slug } = useParams()
  const nav = useNavigate()
  const renditionRef = useRef(null)
  const [title, setTitle] = useState('')
  const [fontSize, setFontSize] = useState(100)
  const [url, setUrl] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [navPath, setNavPath] = useState([]) // [{label, href}]
  const [pageInfo, setPageInfo] = useState({ page: 0, total: 0 })
  const [percentage, setPercentage] = useState(0)
  const containerRef = useRef(null)
  const [toc, setToc] = useState([])
  const [expanded, setExpanded] = useState({})
  const [theme, setTheme] = useState('light') // light | sepia | dark
  const [flowMode, setFlowMode] = useState('paginated') // paginated | scrolled-doc
  const [spreadMode, setSpreadMode] = useState('auto') // auto | none | always
  const [prevCfi, setPrevCfi] = useState('')
  const [showToc, setShowToc] = useState(false) // mobile: TOC overlay
  const [immersive, setImmersive] = useState(false) // fullscreen reading
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setError('')
        setLocation('')
        const res = await fetch('/epubs/index.json?_=' + Date.now())
        if (!res.ok) throw new Error('无法加载书目清单')
        const manifest = await res.json()
        const bookMeta = manifest.find(x => x.slug === slug)
        if (!bookMeta) { nav('/'); return }
        setTitle(bookMeta.title || '阅读')
        // Encode non-ASCII filenames to avoid fetch failures
        const file = typeof bookMeta.file === 'string' ? bookMeta.file : ''
        const encoded = encodeURIComponent(file)
        setUrl(`/epubs/${encoded}`)
        const saved = localStorage.getItem(`epub_loc:${slug}`)
        if (saved) setLocation(saved)
      } catch (e) {
        setError(e.message || '加载失败')
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, nav])

  function toggleExpand(href) {
    setExpanded((s) => ({ ...s, [href]: !s[href] }))
  }

  // TOC tree node component
  function TocNode({ node = {}, depth = 0, currentHref = '', onNavigate }) {
    const children = Array.isArray(node.subitems) ? node.subitems : []
    const hasChildren = children.length > 0
    const href = node.href || ''
    const isExpanded = expanded[href] ?? true
    const isActive = currentHref && href && decodeURIComponent(currentHref).includes(decodeURIComponent(href))
    return (
      <div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer select-none ${isActive ? 'bg-neutral-100 text-neutral-900 font-medium' : 'text-neutral-600 hover:text-neutral-800'}`}
          style={{ paddingLeft: 12 + depth * 12 }}
          onClick={() => {
            if (href) {
              const r = renditionRef.current
              // Resolve href robustly against the spine to avoid 'No Section Found'
              const resolveHref = (raw) => {
                const book = r?.book
                if (!book) return raw
                const variants = []
                const base = String(raw || '')
                const hashIndex = base.indexOf('#')
                const frag = hashIndex >= 0 ? base.slice(hashIndex) : ''
                const nohash = hashIndex >= 0 ? base.slice(0, hashIndex) : base
                variants.push(base)
                variants.push(nohash)
                try { variants.push(decodeURIComponent(base)) } catch {}
                try { variants.push(decodeURIComponent(nohash)) } catch {}
                for (const cand of variants) {
                  const found = book?.spine?.get?.(cand)
                  if (found) return cand + (frag && cand === nohash ? frag : (cand.includes('#') ? '' : frag))
                }
                // fallback: match by suffix
                const items = book?.spine?.items || []
                for (const it of items) {
                  if (nohash.endsWith(it.href) || (decodeURIComponent(nohash || '') || '').endsWith(it.href)) {
                    return it.href + frag
                  }
                }
                // final fallback: canonical to normalize path
                const canonical = book?.canonical?.(nohash) || nohash
                return canonical + frag
              }
              const target = resolveHref(href)
              r?.display(target)
              if (onNavigate) onNavigate()
            }
          }}
        >
          {hasChildren && (
            <button
              className="text-neutral-500 hover:text-neutral-800"
              onClick={(e) => { e.stopPropagation(); toggleExpand(href) }}
              aria-label="toggle"
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
          <span className="truncate" title={node.label}>{node.label || href || '章节'}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map((child, i) => (
              <TocNode key={child.href || child.label || i} node={child} depth={depth + 1} currentHref={currentHref} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    )
  }


  // keyboard navigation like flow Reader: Arrow keys and Space
  useEffect(() => {
    const handler = (e) => {
      if (!renditionRef.current) return
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        renditionRef.current.prev()
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        renditionRef.current.next()
      } else if (e.code === 'Space') {
        e.shiftKey ? renditionRef.current.prev() : renditionRef.current.next()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // sync immersive with Fullscreen API
  useEffect(() => {
    const onFs = () => {
      setImmersive(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  async function toggleImmersive() {
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current
        if (el && el.requestFullscreen) {
          await el.requestFullscreen()
          setImmersive(true)
        } else {
          // fallback: just toggle state to show in-reader exit button
          setImmersive(true)
        }
      } else {
        await document.exitFullscreen?.()
        setImmersive(false)
      }
    } catch (e) {
      // if request fails, still toggle UI so user can exit
      setImmersive((v) => !v)
    }
  }

  // touch swipe navigation for mobile
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e) => {
      const t = e.changedTouches?.[0]
      if (!t) return
      touchStartX.current = t.clientX
      touchStartY.current = t.clientY
      touchStartTime.current = Date.now()
    }
    const onTouchEnd = (e) => {
      const t = e.changedTouches?.[0]
      if (!t) return
      const dx = t.clientX - touchStartX.current
      const dy = t.clientY - touchStartY.current
      const dt = Date.now() - touchStartTime.current
      // horizontal swipe threshold
      if (dt < 600 && Math.abs(dx) > 50 && Math.abs(dy) < 40) {
        if (dx < 0) renditionRef.current?.next(); else renditionRef.current?.prev()
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // helpers to compute breadcrumb path from toc
  function findNavPath(toc, href) {
    const path = []
    function dfs(nodes, stack) {
      for (const n of nodes || []) {
        const s = [...stack, { label: n.label, href: n.href }]
        if (n.href && href && decodeURIComponent(href).includes(decodeURIComponent(n.href))) {
          path.splice(0, path.length, ...s)
          return true
        }
        if (n.subitems && dfs(n.subitems, s)) return true
      }
      return false
    }
    dfs(toc || [], [])
    return path
  }

  return (
    <div>
      {/* Header controls (hidden in immersive mode) */}
      {!immersive && (
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold truncate max-w-[60%] sm:max-w-none">{title}</div>
          <div className="flex gap-2 items-center">
            {/* Mobile: TOC toggle */}
            <button className="h-8 px-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50 md:hidden" onClick={() => setShowToc(true)}>目录</button>
            <button className="h-8 px-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50" onClick={() => setFontSize(s => Math.max(80, s - 10))}>A-</button>
            <button className="h-8 px-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50" onClick={() => setFontSize(s => Math.min(160, s + 10))}>A+</button>
            <button className="h-8 px-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50" onClick={toggleImmersive}>{immersive ? '退出全屏' : '全屏'}</button>
          </div>
        </div>
        {/* Advanced controls hidden on very small screens */}
        <div className="hidden sm:flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-neutral-500">主题</span>
            <select className="h-8 border border-neutral-300 rounded px-2" value={theme} onChange={(e) => {
              const t = e.target.value
              setTheme(t)
              if (renditionRef.current) {
                renditionRef.current.themes.select(t)
              }
            }}>
              <option value="light">浅色</option>
              <option value="sepia">米色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-neutral-500">模式</span>
            <select className="h-8 border border-neutral-300 rounded px-2" value={flowMode} onChange={(e) => {
              const m = e.target.value
              setFlowMode(m)
              renditionRef.current?.flow(m)
            }}>
              <option value="paginated">分页</option>
              <option value="scrolled-doc">滚动</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-neutral-500">铺排</span>
            <select className="h-8 border border-neutral-300 rounded px-2" value={spreadMode} onChange={(e) => {
              const s = e.target.value
              setSpreadMode(s)
              renditionRef.current?.spread(s)
            }}>
              <option value="auto">自动</option>
              <option value="none">单页</option>
              <option value="always">双页</option>
            </select>
          </div>
        </div>
      </div>
      )}
      {error && !immersive && <div className="text-red-600 text-sm py-2">{error}</div>}

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar: hidden on mobile, overlay when toggled; entirely hidden in immersive */}
        {!immersive && (
        <aside className="hidden md:block col-span-12 md:col-span-3 lg:col-span-3 bg-white border border-black/10 rounded overflow-auto" style={{maxHeight: '80vh'}}>
          <div className="py-2">
            {toc.map((n, i) => (
              <TocNode key={n.href || n.label || i} node={n} currentHref={navPath[navPath.length - 1]?.href} />
            ))}
          </div>
        </aside>
        )}

        {/* Reader area */}
        <section className={immersive ? "col-span-12" : "col-span-12 md:col-span-9 lg:col-span-9"}>
          <div className="border border-black/10 rounded overflow-hidden bg-white relative h-[72dvh] md:h-[80vh]" ref={containerRef}>
            {immersive && (
              <button className="absolute top-2 right-2 z-10 h-8 px-2 text-sm border border-neutral-300 rounded bg-white/80 hover:bg-white" onClick={toggleImmersive}>退出全屏</button>
            )}
            {url && (
              <EpubView
                url={url}
                epubOptions={{
                  openAs: 'epub',
                  flow: 'paginated',
                  manager: 'default',
                  allowPopups: true,
                  // allow scripts in iframe to avoid about:srcdoc sandbox blocking
                  allowScriptedContent: true,
                  // some versions of epub.js support overriding sandbox directly
                  iframeSandbox: 'allow-same-origin allow-scripts allow-popups allow-forms',
                  // render iframes via blob urls instead of about:srcdoc to bypass strict sandboxing on mobile browsers
                  replacements: 'blobUrl',
                }}
                {...(location ? { location } : {})}
                onLocationChange={(loc) => {
                  if (typeof loc === 'string' && loc) {
                    setLocation(loc)
                    localStorage.setItem(`epub_loc:${slug}` , loc)
                  }
                }}
                getRendition={async (rendition) => {
                  renditionRef.current = rendition
                  try {
                    // themes similar to flow
                    rendition.themes.register('light', {
                      body: {
                        background: '#ffffff',
                        color: '#222',
                        'font-family': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, 'Noto Serif SC', serif",
                        'line-height': 1.6,
                      }
                    })
                    rendition.themes.register('sepia', {
                      body: {
                        background: '#fdf6e3',
                        color: '#222',
                        'font-family': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, 'Noto Serif SC', serif",
                        'line-height': 1.6,
                      }
                    })
                    rendition.themes.register('dark', {
                      body: {
                        background: '#0f1416',
                        color: '#bfc8ca',
                        'font-family': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, 'Noto Serif SC', serif",
                        'line-height': 1.6,
                      }
                    })
                    rendition.themes.select(theme)
                    rendition.themes.fontSize(fontSize + '%')
                    rendition.flow(flowMode)
                    rendition.spread(spreadMode)

                    const nav = await rendition.book?.loaded?.navigation
                    setToc(nav?.toc || [])

                    rendition.on('relocated', async (loc) => {
                      try {
                        const { start } = loc || {}
                        const page = start?.displayed?.page ?? 0
                        const total = start?.displayed?.total ?? 0
                        setPageInfo({ page, total })
                        const href = start?.href || ''
                        const path = findNavPath(nav?.toc || toc, href)
                        setNavPath(path)
                        const locations = await rendition.book?.locations?.save()
                        if (locations) {
                          const percent = rendition.book?.locations?.percentageFromCfi(start?.cfi)
                          setPercentage(typeof percent === 'number' ? percent : 0)
                        }
                      } catch {}
                    })

                    const iframe = rendition?.getContents?.()[0]?.document?.defaultView
                    if (iframe) {
                      iframe.addEventListener('wheel', (e) => {
                        if (e.deltaY < 0) rendition.prev(); else rendition.next()
                      }, { passive: true })
                    }

                    // capture link clicks to enable Return banner
                    rendition.on('rendered', () => {
                      const contents = rendition.getContents()
                      contents.forEach((c) => {
                        const doc = c.document
                        if (!doc) return
                        // Fallback: ensure iframe sandbox allows scripts/popups if options were ignored
                        try {
                          const frameEl = doc.defaultView && doc.defaultView.frameElement
                          if (frameEl && frameEl.getAttribute) {
                            const current = frameEl.getAttribute('sandbox') || ''
                            const needed = 'allow-same-origin allow-scripts allow-popups allow-forms'
                            if (!current.includes('allow-scripts')) {
                              frameEl.setAttribute('sandbox', needed)
                            }
                          }
                        } catch {}
                        doc.addEventListener('click', (e) => {
                          const path = e.composedPath?.() || []
                          for (const el of path) {
                            if (el && el.tagName === 'A' && el.getAttribute) {
                              try {
                                const loc = rendition.currentLocation?.()
                                const cfi = loc?.start?.cfi
                                if (cfi) setPrevCfi(cfi)
                              } catch {}
                              break
                            }
                          }
                        }, true)
                      })
                    })

                    const saved = localStorage.getItem(`epub_loc:${slug}`)
                    if (saved) {
                      try {
                        await rendition.display(saved)
                      } catch (e) {
                        localStorage.removeItem(`epub_loc:${slug}`)
                        setLocation('')
                        setError('上次阅读位置无效，已重置到开头')
                        await rendition.display()
                      }
                    }
                  } catch (e) {
                    console.error('[rendition] init error', e)
                    setError(e?.message || '阅读器初始化失败')
                  }
                }}
              />
            )}
            {/* click zones: left/right 30% for prev/next */}
            <div className="absolute inset-y-0 left-0" style={{width: '30%'}} onClick={() => renditionRef.current?.prev()} />
            <div className="absolute inset-y-0 right-0" style={{width: '30%'}} onClick={() => renditionRef.current?.next()} />
          </div>
        </section>
      </div>

      {/* header breadcrumb like flow */}
      {!immersive && navPath.length > 0 && (
        <div className="text-neutral-500 text-sm mt-2">
          {navPath.map((n, i) => (
            <span key={i}>
              {n.label}{i !== navPath.length - 1 ? ' > ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* footer like flow: href + percentage + page info */}
      {!immersive && (
      <div className="flex items-center justify-between mt-2 text-neutral-500 text-sm">
        <div className="truncate mr-3" title={location}>{navPath[navPath.length - 1]?.href || ''}</div>
        <div>{Math.round(percentage * 100) || 0}%</div>
        <div>{pageInfo.page || 0} / {pageInfo.total || 0}</div>
      </div>
      )}

      {/* Return-to banner */}
      {prevCfi && !immersive && (
        <div className="mt-2 text-sm flex items-center gap-2 text-neutral-700">
          <span className="truncate">已跳转，返回上个位置？</span>
          <button className="h-8 px-2 border border-neutral-300 rounded hover:bg-neutral-50" onClick={() => {
            const cfi = prevCfi
            setPrevCfi('')
            renditionRef.current?.display(cfi)
          }}>返回</button>
          <button className="h-8 px-2 border border-neutral-300 rounded hover:bg-neutral-50" onClick={() => setPrevCfi('')}>保留当前位置</button>
        </div>
      )}

      {/* Mobile TOC overlay */}
      {showToc && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowToc(false)} />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-sm bg-white shadow-xl border-r border-black/10 flex flex-col">
            <div className="h-12 flex items-center justify-between px-3 border-b border-black/10">
              <div className="font-medium">目录</div>
              <button className="h-8 px-2 text-sm border border-neutral-300 rounded" onClick={() => setShowToc(false)}>关闭</button>
            </div>
            <div className="flex-1 overflow-auto py-2">
              {toc.map((n, i) => (
                <TocNode key={n.href || n.label || i} node={n} currentHref={navPath[navPath.length - 1]?.href} onNavigate={() => setShowToc(false)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
