import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDownloadUrl } from '@/lib/r2'

export async function POST(req: NextRequest) {
  const { file_ids, gallery_slug } = await req.json()

  if (!file_ids?.length || !gallery_slug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify gallery exists and not expired
  const { data: gallery } = await supabaseAdmin()
    .from('galleries')
    .select('id, expires_at')
    .eq('slug', gallery_slug)
    .single()

  if (!gallery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Expired' }, { status: 410 })
  }

  // Get files that belong to this gallery
  const { data: files } = await supabaseAdmin()
    .from('files')
    .select('*')
    .in('id', file_ids)
    .eq('gallery_id', gallery.id)

  if (!files?.length) return NextResponse.json({ error: 'No files' }, { status: 404 })

  // Generate download URLs (1 hour expiry)
  const urls = await Promise.all(
    files.map(async (f) => ({
      filename: f.filename,
      url: await getDownloadUrl(f.file_key, f.filename, 3600),
    }))
  )

  return NextResponse.json({ urls })
}
