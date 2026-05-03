'use client'
import { useState, useRef } from 'react'

interface Gallery {
  id: string
  client_name: string
  slug: string
  expires_at: string | null
  created_at: string
  files: { count: number }[]
}

interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  name: string
}

interface GalleryFileItem {
  id: string
  filename: string
  file_type: 'photo' | 'video'
  file_size: number
  preview_url: string
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(false)
  const [activeGallery, setActiveGallery] = useState<Gallery | null>(null)
  const [uploads, setUploads] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ client_name: '', slug: '', expires_days: '30' })
  const [creating, setCreating] = useState(false)
  const [expandedGallery, setExpandedGallery] = useState<string | null>(null)
  const [galleryFiles, setGalleryFiles] = useState<Record<string, GalleryFileItem[]>>({})
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loadingFiles, setLoadingFiles] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const headers = { 'x-admin-password': password, 'Content-Type': 'application/json' }

  async function login() {
    setLoading(true)
    const res = await fetch('/api/admin/galleries', { headers: { 'x-admin-password': password } })
    if (res.ok) {
      const data = await res.json()
      setGalleries(data.galleries)
      setAuthed(true)
    } else {
      alert('Wrong password')
    }
    setLoading(false)
  }

  async function loadGalleries() {
    const res = await fetch('/api/admin/galleries', { headers: { 'x-admin-password': password } })
    if (res.ok) {
      const data = await res.json()
      setGalleries(data.galleries)
    }
  }

  async function createGallery() {
    if (!form.client_name || !form.slug) return
    setCreating(true)
    const res = await fetch('/api/admin/galleries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_name: form.client_name,
        slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
        expires_days: form.expires_days ? parseInt(form.expires_days) : null,
      }),
    })
    if (res.ok) {
      setForm({ client_name: '', slug: '', expires_days: '30' })
      await loadGalleries()
    }
    setCreating(false)
  }

  async function deleteGallery(id: string, name: string) {
    if (!confirm(`Delete gallery "${name}"? This cannot be undone.`)) return
    await fetch('/api/admin/galleries', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id }),
    })
    await loadGalleries()
    if (expandedGallery === id) setExpandedGallery(null)
  }

  async function loadGalleryFiles(galleryId: string, slug: string) {
    if (expandedGallery === galleryId) {
      setExpandedGallery(null)
      return
    }
    setLoadingFiles(galleryId)
    const res = await fetch(`/api/gallery/${slug}`)
    const data = await res.json()
    if (data.files) {
      setGalleryFiles(prev => ({ ...prev, [galleryId]: data.files }))
    }
    setExpandedGallery(galleryId)
    setSelectedFiles(new Set())
    setLoadingFiles(null)
  }

  async function deleteSelectedFiles(galleryId: string, slug: string) {
    if (!selectedFiles.size) return
    if (!confirm(`Delete ${selectedFiles.size} file(s)?`)) return
    await fetch('/api/admin/files', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ file_ids: Array.from(selectedFiles) }),
    })
    setSelectedFiles(new Set())
    await loadGalleryFiles(galleryId, slug)
    await loadGalleries()
  }

  function toggleFileSelect(id: string) {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function uploadFiles(galleryId: string, files: File[]) {
    setUploading(true)
    const uploadList: UploadFile[] = files.map(f => ({
      file: f, progress: 0, status: 'pending', name: f.name
    }))
    setUploads(uploadList)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'uploading' } : u))
try {
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { 'x-admin-password': password, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gallery_id: galleryId,
      filename: file.name,
      content_type: file.type,
      file_size: file.size,
    }),
  })
  const { upload_url } = await res.json()

  await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'done', progress: 100 } : u))
      } catch {
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'error' } : u))
      }
    }

    setUploading(false)
    await loadGalleries()

    // Refresh file list if expanded
    if (activeGallery && expandedGallery === activeGallery.id) {
      await loadGalleryFiles(activeGallery.id, activeGallery.slug)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeGallery || !e.target.files?.length) return
    uploadFiles(activeGallery.id, Array.from(e.target.files))
    e.target.value = ''
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/gallery/${slug}`
    navigator.clipboard.writeText(url)
  }

  function autoSlug(name: string) {
    return name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
  }

  function formatSize(bytes: number) {
    if (!bytes) return ''
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  if (!authed) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginBox}>
          <div style={s.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
          <div style={s.loginTitle}>Admin Panel</div>
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          <button style={s.btnGold} onClick={login} disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
        <div style={s.headerTitle}>Admin Panel</div>
      </div>

      <div style={s.content}>
        {/* Create Gallery */}
        <div style={s.card}>
          <div style={s.cardTitle}>New Gallery</div>
          <div style={s.formRow}>
            <input
              style={s.input}
              placeholder="Client name (e.g. Олена & Андрій)"
              value={form.client_name}
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value, slug: autoSlug(e.target.value) }))}
            />
            <input
              style={s.input}
              placeholder="URL slug"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            />
            <select
              style={s.input}
              value={form.expires_days}
              onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
            >
              <option value="7">Expires in 7 days</option>
              <option value="30">Expires in 30 days</option>
              <option value="90">Expires in 90 days</option>
              <option value="">Never expires</option>
            </select>
            <button style={s.btnGold} onClick={createGallery} disabled={creating}>
              {creating ? 'Creating…' : 'Create Gallery'}
            </button>
          </div>
        </div>

        {/* Galleries */}
        <div style={s.card}>
          <div style={s.cardTitle}>Galleries ({galleries.length})</div>
          {galleries.length === 0 && <div style={s.empty}>No galleries yet.</div>}
          {galleries.map(g => (
            <div key={g.id}>
              <div style={s.galleryRow}>
                <div style={s.galleryInfo}>
                  <div style={s.galleryName}>{g.client_name}</div>
                  <div style={s.galleryMeta}>
                    /gallery/{g.slug} · {g.files?.[0]?.count ?? 0} files ·{' '}
                    {g.expires_at ? `expires ${new Date(g.expires_at).toLocaleDateString()}` : 'no expiry'}
                  </div>
                </div>
                <div style={s.galleryActions}>
                  <button style={s.btnOutline} onClick={() => copyLink(g.slug)}>Copy Link</button>
                  <button
                    style={s.btnGold}
                    onClick={() => { setActiveGallery(g); setUploads([]); fileInputRef.current?.click() }}
                  >
                    Upload
                  </button>
                  <button
                    style={s.btnOutline}
                    onClick={() => loadGalleryFiles(g.id, g.slug)}
                  >
                    {loadingFiles === g.id ? '…' : expandedGallery === g.id ? 'Hide Files' : 'View Files'}
                  </button>
                  <a href={`/gallery/${g.slug}`} target="_blank" style={s.btnOutline}>Preview</a>
                  <button
                    style={s.btnDanger}
                    onClick={() => deleteGallery(g.id, g.client_name)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* File list */}
              {expandedGallery === g.id && galleryFiles[g.id] && (
                <div style={s.fileList}>
                  {selectedFiles.size > 0 && (
                    <div style={s.fileListToolbar}>
                      <span style={s.selCount}>{selectedFiles.size} selected</span>
                      <button
                        style={s.btnDanger}
                        onClick={() => deleteSelectedFiles(g.id, g.slug)}
                      >
                        Delete Selected
                      </button>
                    </div>
                  )}
                  {galleryFiles[g.id].length === 0 && (
                    <div style={s.empty}>No files in this gallery.</div>
                  )}
                  <div style={s.fileGrid}>
                    {galleryFiles[g.id].map(f => (
                      <div
                        key={f.id}
                        style={{
                          ...s.fileCard,
                          ...(selectedFiles.has(f.id) ? s.fileCardSelected : {}),
                        }}
                        onClick={() => toggleFileSelect(f.id)}
                      >
                        {f.file_type === 'photo' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.preview_url} alt={f.filename} style={s.fileThumb} />
                        ) : (
                          <div style={s.videoFileThumb}>
                            <span style={s.videoLabel}>▶ VIDEO</span>
                          </div>
                        )}
                        {selectedFiles.has(f.id) && (
                          <div style={s.fileCheckmark}>✓</div>
                        )}
                        <div style={s.fileName}>{f.filename}</div>
                        <div style={s.fileSize}>{formatSize(f.file_size)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div style={s.card}>
            <div style={s.cardTitle}>
              Upload: {activeGallery?.client_name}
              {uploading ? ' — uploading…' : ' — done ✓'}
            </div>
            {uploads.map((u, i) => (
              <div key={i} style={s.uploadRow}>
                <div style={s.uploadName}>{u.name}</div>
                <div style={{
                  ...s.uploadStatus,
                  color: u.status === 'done' ? 'var(--gold)' : u.status === 'error' ? '#e55' : 'var(--white-dim)'
                }}>
                  {u.status === 'pending' && 'Waiting…'}
                  {u.status === 'uploading' && 'Uploading…'}
                  {u.status === 'done' && '✓ Done'}
                  {u.status === 'error' && '✗ Error'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)' },
  loginBox: { background: '#0d0d0d', border: '1px solid rgba(201,168,76,0.15)', padding: '48px', width: '360px', display: 'flex', flexDirection: 'column', gap: '20px' },
  logo: { fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 300, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--white)' },
  loginTitle: { fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase' as const, color: 'var(--white-dim)' },
  wrap: { minHeight: '100vh', background: 'var(--black)' },
  header: { padding: '24px 48px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', gap: '24px', background: 'rgba(5,5,5,0.95)', position: 'sticky' as const, top: 0, zIndex: 100 },
  headerTitle: { fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase' as const, color: 'var(--white-dim)', paddingLeft: '24px', borderLeft: '1px solid rgba(201,168,76,0.15)' },
  content: { padding: '48px', display: 'flex', flexDirection: 'column' as const, gap: '24px', maxWidth: '1200px' },
  card: { background: '#0d0d0d', border: '1px solid rgba(201,168,76,0.1)', padding: '32px', display: 'flex', flexDirection: 'column' as const, gap: '20px' },
  cardTitle: { fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase' as const, color: 'var(--gold)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' as const },
  input: { flex: 1, minWidth: '180px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--white)', fontSize: '12px', fontFamily: "'Montserrat', sans-serif", outline: 'none' },
  btnGold: { padding: '12px 24px', background: 'var(--gold)', color: '#050505', border: 'none', fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase' as const, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: "'Montserrat', sans-serif" },
  btnOutline: { padding: '10px 20px', background: 'transparent', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.3)', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: "'Montserrat', sans-serif", display: 'inline-block', textAlign: 'center' as const },
  btnDanger: { padding: '10px 20px', background: 'transparent', color: '#e55', border: '1px solid rgba(220,80,80,0.3)', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: "'Montserrat', sans-serif" },
  galleryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: '20px', flexWrap: 'wrap' as const },
  galleryInfo: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  galleryName: { fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 300, color: 'var(--white)' },
  galleryMeta: { fontSize: '10px', letterSpacing: '0.15em', color: 'var(--white-dim)' },
  galleryActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  empty: { fontSize: '11px', color: 'var(--white-dim)', letterSpacing: '0.1em', padding: '20px 0' },
  fileList: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.08)', padding: '20px', marginBottom: '4px' },
  fileListToolbar: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  selCount: { fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--gold)' },
  fileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' },
  fileCard: { position: 'relative' as const, cursor: 'pointer', border: '1px solid rgba(201,168,76,0.08)', overflow: 'hidden', transition: 'border-color 0.2s' },
  fileCardSelected: { borderColor: 'var(--gold)', outline: '2px solid var(--gold)' },
  fileThumb: { width: '100%', aspectRatio: '1', objectFit: 'cover' as const, display: 'block', filter: 'brightness(0.85)' },
  videoFileThumb: { width: '100%', aspectRatio: '1', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  videoLabel: { fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)' },
  fileCheckmark: { position: 'absolute' as const, top: 6, right: 6, width: 20, height: 20, background: 'var(--gold)', color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 },
  fileName: { fontSize: '8px', letterSpacing: '0.05em', color: 'var(--white-dim)', padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  fileSize: { fontSize: '8px', color: 'rgba(201,168,76,0.5)', padding: '0 6px 4px' },
  uploadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  uploadName: { fontSize: '11px', color: 'var(--white-dim)', letterSpacing: '0.05em' },
  uploadStatus: { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const },
}
