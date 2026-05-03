'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface GalleryFile {
  id: string
  filename: string
  file_type: 'photo' | 'video'
  file_size: number
  download_url: string
}

interface Gallery {
  client_name: string
  expires_at: string | null
}

type Lang = 'en' | 'uk' | 'sv'

const t = {
  en: {
    all: 'All', photos: 'Photos', videos: 'Videos',
    selectAll: 'Select All', deselectAll: 'Deselect All',
    downloadSelected: 'Download Selected', downloadAll: 'Download All',
    selected: (n: number) => `${n} selected`,
    expires: (d: string) => `Gallery available until ${d}`,
    loading: 'Loading your gallery…',
    notFound: 'Gallery not found',
    expired: 'This gallery has expired',
    preparing: 'Preparing download…',
    files: (n: number) => `${n} files`,
  },
  uk: {
    all: 'Всі', photos: 'Фото', videos: 'Відео',
    selectAll: 'Вибрати все', deselectAll: 'Зняти вибір',
    downloadSelected: 'Завантажити вибране', downloadAll: 'Завантажити все',
    selected: (n: number) => `Вибрано: ${n}`,
    expires: (d: string) => `Галерея доступна до ${d}`,
    loading: 'Завантаження галереї…',
    notFound: 'Галерею не знайдено',
    expired: 'Термін дії галереї закінчився',
    preparing: 'Підготовка завантаження…',
    files: (n: number) => `${n} файлів`,
  },
  sv: {
    all: 'Alla', photos: 'Foton', videos: 'Video',
    selectAll: 'Välj alla', deselectAll: 'Avmarkera alla',
    downloadSelected: 'Ladda ner valda', downloadAll: 'Ladda ner allt',
    selected: (n: number) => `${n} valda`,
    expires: (d: string) => `Galleriet tillgängligt till ${d}`,
    loading: 'Laddar ditt galleri…',
    notFound: 'Galleriet hittades inte',
    expired: 'Det här galleriet har gått ut',
    preparing: 'Förbereder nedladdning…',
    files: (n: number) => `${n} filer`,
  },
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

export default function GalleryPage() {
  const params = useParams()
  const slug = params.slug as string

  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [files, setFiles] = useState<GalleryFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lang, setLang] = useState<Lang>('en')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const T = t[lang]

  useEffect(() => {
    fetch(`/api/gallery/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setGallery(data.gallery)
        setFiles(data.files)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [slug])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox === null) return
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox(i => i !== null ? Math.min(i + 1, visible.length - 1) : null)
      if (e.key === 'ArrowLeft') setLightbox(i => i !== null ? Math.max(i - 1, 0) : null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, files, filter])

  const visible = files.filter(f => filter === 'all' || f.file_type === filter)

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === visible.length) setSelected(new Set())
    else setSelected(new Set(visible.map(f => f.id)))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function downloadSelected() {
    if (!selected.size) return
    showToast(T.preparing)
    const res = await fetch('/api/gallery/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_ids: Array.from(selected), gallery_slug: slug }),
    })
    const data = await res.json()
    if (data.urls) {
      data.urls.forEach(({ url, filename }: { url: string; filename: string }) => {
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
      })
    }
  }

  async function downloadAll() {
    showToast(T.preparing)
    const res = await fetch('/api/gallery/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_ids: files.map(f => f.id), gallery_slug: slug }),
    })
    const data = await res.json()
    if (data.urls) {
      data.urls.forEach(({ url, filename }: { url: string; filename: string }) => {
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
      })
    }
  }

  function setLangAndUpdate(l: Lang) { setLang(l) }

  if (loading) return (
    <div style={s.center}>
      <div style={s.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
      <div style={s.loadingText}>{T.loading}</div>
    </div>
  )

  if (error) return (
    <div style={s.center}>
      <div style={s.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
      <div style={s.errorText}>{error === 'Gallery expired' ? T.expired : T.notFound}</div>
    </div>
  )

  const lbFile = lightbox !== null ? visible[lightbox] : null

  return (
    <div style={s.wrap}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
        <div style={s.navMeta}>
          <div style={s.clientName}>{gallery?.client_name}</div>
          <div style={s.galleryMeta}>{T.files(files.length)}</div>
        </div>
        <div style={s.langSwitch}>
          {(['en', 'uk', 'sv'] as Lang[]).map((l, i) => (
            <span key={l}>
              {i > 0 && <span style={{ opacity: 0.3, margin: '0 4px' }}>/</span>}
              <span
                onClick={() => setLangAndUpdate(l)}
                style={{ ...s.langBtn, color: lang === l ? 'var(--gold)' : 'var(--white-dim)', cursor: 'pointer' }}
              >
                {l.toUpperCase()}
              </span>
            </span>
          ))}
        </div>
      </nav>

      {/* EXPIRY */}
      {gallery?.expires_at && (
        <div style={s.expiryBanner}>
          <div style={s.expiryDot} />
          <div style={s.expiryText}>
            {T.expires(new Date(gallery.expires_at).toLocaleDateString())}
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <div style={s.filterTabs}>
            {(['all', 'photo', 'video'] as const).map(f => (
              <button
                key={f}
                style={{ ...s.filterTab, ...(filter === f ? s.filterTabActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? T.all : f === 'photo' ? T.photos : T.videos}
              </button>
            ))}
          </div>
          <button style={s.selectAllBtn} onClick={toggleSelectAll}>
            {selected.size === visible.length && visible.length > 0 ? T.deselectAll : T.selectAll}
          </button>
        </div>
        <div style={s.toolbarRight}>
          {selected.size > 0 && (
            <span style={s.selCount}>{T.selected(selected.size)}</span>
          )}
          <button
            style={{ ...s.dlBtn, opacity: selected.size > 0 ? 1 : 0.3 }}
            onClick={downloadSelected}
            disabled={selected.size === 0}
          >
            {T.downloadSelected}
          </button>
          <button style={s.dlAllBtn} onClick={downloadAll}>
            {T.downloadAll}
          </button>
        </div>
      </div>

      {/* MASONRY */}
      <div style={s.galleryWrap}>
        <div style={s.masonry}>
          {visible.map((f, idx) => (
            <div
              key={f.id}
              style={{
                ...s.masonryItem,
                ...(selected.has(f.id) ? s.masonryItemSelected : {}),
              }}
              onClick={() => setLightbox(idx)}
            >
              {f.file_type === 'video' ? (
                <div style={s.videoThumb}>
                  <div style={s.playBtn}>
                    <div style={s.playIcon} />
                  </div>
                  <div style={s.videoBadge}>4K</div>
                  <div style={s.videoPlaceholder} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.preview_url}
                  alt={f.filename}
                  style={s.img}
                  loading="lazy"
                />
              )}

              {/* Checkbox */}
              <div
                style={{
                  ...s.checkbox,
                  opacity: selected.has(f.id) ? 1 : undefined,
                  background: selected.has(f.id) ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
                  borderColor: selected.has(f.id) ? 'var(--gold)' : 'rgba(201,168,76,0.7)',
                }}
                onClick={e => { e.stopPropagation(); toggleSelect(f.id) }}
              >
                {selected.has(f.id) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#050505" strokeWidth="2">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                  </svg>
                )}
              </div>

              {/* Meta */}
              <div style={s.itemMeta}>
                <span style={s.itemFilename}>{f.filename}</span>
                <span style={s.itemSize}>{formatSize(f.file_size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox !== null && lbFile && (
        <div style={s.lightbox} onClick={() => setLightbox(null)}>
          <div style={s.lbClose} onClick={() => setLightbox(null)}>
            <svg width="16" height="16" fill="none" stroke="var(--gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>

          <div style={s.lbPrev} onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(0, (i ?? 0) - 1)) }}>
            <svg width="18" height="18" fill="none" stroke="var(--gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>

          <div style={s.lbInner} onClick={e => e.stopPropagation()}>
            {lbFile.file_type === 'video' ? (
              <video controls autoPlay style={s.lbMedia} src={lbFile.download_url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lbFile.download_url} alt={lbFile.filename} style={s.lbMedia} />
            )}
          </div>

          <div style={s.lbNext} onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(visible.length - 1, (i ?? 0) + 1)) }}>
            <svg width="18" height="18" fill="none" stroke="var(--gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div style={s.lbInfo} onClick={e => e.stopPropagation()}>
            <span style={s.lbCounter}>{(lightbox + 1)} / {visible.length}</span>
            <span style={s.lbFilename}>{lbFile.filename}</span>
            <button
              style={{
                ...s.lbSelectBtn,
                ...(selected.has(lbFile.id) ? s.lbSelectBtnActive : {}),
              }}
              onClick={() => toggleSelect(lbFile.id)}
            >
              {selected.has(lbFile.id) ? '✓ Selected' : 'Select'}
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', background: 'var(--black)' },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: 'var(--black)' },
  logo: { fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 300, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--white)' },
  loadingText: { fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase' as const, color: 'var(--white-dim)' },
  errorText: { fontSize: '14px', letterSpacing: '0.2em', color: 'rgba(201,168,76,0.7)' },
  nav: { position: 'sticky' as const, top: 0, zIndex: 200, background: 'rgba(5,5,5,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', padding: '20px 48px', gap: '24px' },
  navMeta: { display: 'flex', flexDirection: 'column' as const, gap: '3px', flex: 1, paddingLeft: '24px', borderLeft: '1px solid rgba(201,168,76,0.15)' },
  clientName: { fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: 300 },
  galleryMeta: { fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: 'var(--white-dim)' },
  langSwitch: { display: 'flex', alignItems: 'center', fontSize: '9px', letterSpacing: '0.3em' },
  langBtn: { transition: 'color 0.2s' },
  expiryBanner: { padding: '12px 48px', background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', gap: '12px' },
  expiryDot: { width: 6, height: 6, background: 'var(--gold)', borderRadius: '50%', flexShrink: 0 },
  expiryText: { fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--white-dim)' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', borderBottom: '1px solid rgba(201,168,76,0.08)', background: 'var(--black-soft)', gap: '16px', flexWrap: 'wrap' as const },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const },
  filterTabs: { display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '3px', border: '1px solid rgba(201,168,76,0.1)' },
  filterTab: { padding: '7px 18px', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: 'var(--white-dim)', cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.2s' },
  filterTabActive: { background: 'var(--gold)', color: '#050505', fontWeight: 500 },
  selectAllBtn: { padding: '8px 18px', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: 'var(--white-dim)', background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.2s' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const },
  selCount: { fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--gold)' },
  dlBtn: { padding: '10px 22px', background: 'var(--gold)', color: '#050505', border: 'none', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, fontWeight: 500, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.2s' },
  dlAllBtn: { padding: '10px 22px', background: 'transparent', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.35)', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.2s' },
  galleryWrap: { padding: '32px 48px 80px' },
  masonry: { columns: 4, columnGap: '8px' },
  masonryItem: { breakInside: 'avoid' as const, marginBottom: '8px', position: 'relative' as const, overflow: 'hidden', cursor: 'pointer', background: 'var(--black-card)', display: 'block' },
  masonryItemSelected: { outline: '2px solid var(--gold)' },
  img: { display: 'block', width: '100%', height: 'auto', transition: 'transform 0.4s ease, filter 0.3s ease', filter: 'brightness(0.92)' },
  videoThumb: { position: 'relative' as const, paddingBottom: '66%', background: '#0a0a0a', display: 'block' },
  videoPlaceholder: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)' },
  playBtn: { position: 'absolute' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 52, height: 52, border: '1.5px solid rgba(201,168,76,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 5 },
  playIcon: { width: 0, height: 0, borderStyle: 'solid', borderWidth: '8px 0 8px 16px', borderColor: 'transparent transparent transparent var(--gold)', marginLeft: 3 },
  videoBadge: { position: 'absolute' as const, top: 12, right: 12, padding: '4px 10px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(201,168,76,0.3)', fontSize: 8, letterSpacing: '0.3em', color: 'var(--gold)', textTransform: 'uppercase' as const, zIndex: 5 },
  checkbox: { position: 'absolute' as const, top: 10, left: 10, width: 22, height: 22, border: '1px solid rgba(201,168,76,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.2s', opacity: 0 },
  itemMeta: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: '20px 12px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', opacity: 0, transition: 'opacity 0.3s' },
  itemFilename: { fontSize: 9, letterSpacing: '0.1em', color: 'rgba(245,240,232,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '70%' },
  itemSize: { fontSize: 9, color: 'rgba(201,168,76,0.7)', flexShrink: 0 },
  lightbox: { position: 'fixed' as const, inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lbClose: { position: 'fixed' as const, top: 24, right: 32, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.3)', cursor: 'pointer', zIndex: 810 },
  lbPrev: { position: 'fixed' as const, left: 20, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.2)', cursor: 'pointer', zIndex: 810 },
  lbNext: { position: 'fixed' as const, right: 20, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.2)', cursor: 'pointer', zIndex: 810 },
  lbInner: { maxWidth: '88vw', maxHeight: '82vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lbMedia: { maxWidth: '88vw', maxHeight: '82vh', objectFit: 'contain' as const, display: 'block' },
  lbInfo: { position: 'fixed' as const, bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 810 },
  lbCounter: { fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: 'var(--gold)' },
  lbFilename: { fontSize: 10, letterSpacing: '0.2em', color: 'var(--white-dim)' },
  lbSelectBtn: { padding: '8px 20px', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase' as const, border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)', background: 'transparent', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" },
  lbSelectBtnActive: { background: 'var(--gold)', color: '#050505', fontWeight: 500 },
  toast: { position: 'fixed' as const, bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#050505', padding: '14px 28px', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' as const, fontWeight: 500, zIndex: 999, whiteSpace: 'nowrap' as const },
}
