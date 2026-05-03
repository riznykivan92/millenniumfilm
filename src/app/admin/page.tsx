'use client'
import { useState, useEffect, useRef } from 'react'

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

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(false)
  const [activeGallery, setActiveGallery] = useState<Gallery | null>(null)
  const [uploads, setUploads] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // New gallery form
  const [form, setForm] = useState({ client_name: '', slug: '', expires_days: '30' })
  const [creating, setCreating] = useState(false)

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
        // Get presigned URL
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            gallery_id: galleryId,
            filename: file.name,
            content_type: file.type,
            file_size: file.size,
          }),
        })
        const { upload_url } = await res.json()

        // Upload directly to R2
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
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeGallery || !e.target.files?.length) return
    uploadFiles(activeGallery.id, Array.from(e.target.files))
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

  if (!authed) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginBox}>
          <div style={styles.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
          <div style={styles.loginTitle}>Admin Panel</div>
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          <button style={styles.btnGold} onClick={login} disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>Millennium<span style={{ color: 'var(--gold)' }}>Film</span></div>
        <div style={styles.headerTitle}>Admin Panel</div>
      </div>

      <div style={styles.content}>
        {/* Create Gallery */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>New Gallery</div>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              placeholder="Client name (e.g. Олена & Андрій)"
              value={form.client_name}
              onChange={e => {
                setForm(f => ({ ...f, client_name: e.target.value, slug: autoSlug(e.target.value) }))
              }}
            />
            <input
              style={styles.input}
              placeholder="URL slug (e.g. olena-andriy-2025)"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            />
            <select
              style={styles.input}
              value={form.expires_days}
              onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
            >
              <option value="7">Expires in 7 days</option>
              <option value="30">Expires in 30 days</option>
              <option value="90">Expires in 90 days</option>
              <option value="">Never expires</option>
            </select>
            <button style={styles.btnGold} onClick={createGallery} disabled={creating}>
              {creating ? 'Creating…' : 'Create Gallery'}
            </button>
          </div>
        </div>

        {/* Galleries List */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Galleries ({galleries.length})</div>
          {galleries.length === 0 && (
            <div style={styles.empty}>No galleries yet. Create one above.</div>
          )}
          {galleries.map(g => (
            <div key={g.id} style={styles.galleryRow}>
              <div style={styles.galleryInfo}>
                <div style={styles.galleryName}>{g.client_name}</div>
                <div style={styles.galleryMeta}>
                  /gallery/{g.slug} ·{' '}
                  {g.files?.[0]?.count ?? 0} files ·{' '}
                  {g.expires_at
                    ? `expires ${new Date(g.expires_at).toLocaleDateString()}`
                    : 'no expiry'}
                </div>
              </div>
              <div style={styles.galleryActions}>
                <button
                  style={styles.btnOutline}
                  onClick={() => copyLink(g.slug)}
                >
                  Copy Link
                </button>
                <button
                  style={styles.btnGold}
                  onClick={() => {
                    setActiveGallery(g)
                    setUploads([])
                    fileInputRef.current?.click()
                  }}
                >
                  Upload Files
                </button>
                <a
                  href={`/gallery/${g.slug}`}
                  target="_blank"
                  style={styles.btnOutline}
                >
                  Preview
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              Upload: {activeGallery?.client_name}
              {uploading && ' — uploading…'}
              {!uploading && ' — done ✓'}
            </div>
            {uploads.map((u, i) => (
              <div key={i} style={styles.uploadRow}>
                <div style={styles.uploadName}>{u.name}</div>
                <div style={{
                  ...styles.uploadStatus,
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

      {/* Hidden file input */}
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

const styles: Record<string, React.CSSProperties> = {
  loginWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--black)',
  },
  loginBox: {
    background: '#0d0d0d',
    border: '1px solid rgba(201,168,76,0.15)',
    padding: '48px',
    width: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '22px',
    fontWeight: 300,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'var(--white)',
  },
  loginTitle: {
    fontSize: '10px',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: 'var(--white-dim)',
  },
  wrap: {
    minHeight: '100vh',
    background: 'var(--black)',
  },
  header: {
    padding: '24px 48px',
    borderBottom: '1px solid rgba(201,168,76,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    background: 'rgba(5,5,5,0.95)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: '10px',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: 'var(--white-dim)',
    paddingLeft: '24px',
    borderLeft: '1px solid rgba(201,168,76,0.15)',
  },
  content: {
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1100px',
  },
  card: {
    background: '#0d0d0d',
    border: '1px solid rgba(201,168,76,0.1)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardTitle: {
    fontSize: '10px',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: 'var(--gold)',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: '180px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.2)',
    color: 'var(--white)',
    fontSize: '12px',
    fontFamily: "'Montserrat', sans-serif",
    outline: 'none',
  },
  btnGold: {
    padding: '12px 24px',
    background: 'var(--gold)',
    color: '#050505',
    border: 'none',
    fontSize: '10px',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'Montserrat', sans-serif",
  },
  btnOutline: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--gold)',
    border: '1px solid rgba(201,168,76,0.3)',
    fontSize: '10px',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'Montserrat', sans-serif",
    display: 'inline-block',
    textAlign: 'center',
  },
  galleryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    gap: '20px',
    flexWrap: 'wrap',
  },
  galleryInfo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  galleryName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '22px',
    fontWeight: 300,
    color: 'var(--white)',
  },
  galleryMeta: {
    fontSize: '10px',
    letterSpacing: '0.15em',
    color: 'var(--white-dim)',
  },
  galleryActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  empty: {
    fontSize: '11px',
    color: 'var(--white-dim)',
    letterSpacing: '0.1em',
    padding: '20px 0',
  },
  uploadRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  uploadName: {
    fontSize: '11px',
    color: 'var(--white-dim)',
    letterSpacing: '0.05em',
  },
  uploadStatus: {
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },
}
