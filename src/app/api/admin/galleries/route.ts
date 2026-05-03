export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  const { data: gallery, error: gError } = await supabaseAdmin()
    .from('galleries')
    .select('*')
    .eq('slug', slug)
    .single()

  if (gError || !gallery) {
    return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })
  }

  if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Gallery expired' }, { status: 410 })
  }

  const { data: files, error: fError } = await supabaseAdmin()
    .from('files')
    .select('*')
    .eq('gallery_id', gallery.id)
    .order('created_at', { ascending: true })

  if (fError) {
    return NextResponse.json({ error: fError.message }, { status: 500 })
  }

  const publicBase = process.env.R2_PUBLIC_URL

  const filesWithUrls = await Promise.all(
    (files || []).map(async (f) => ({
      ...f,
      // Public URL for fast preview in browser
      preview_url: `${publicBase}/${f.file_key}`,
      // Signed URL for actual download (forces download, 1hr expiry)
      download_url: await getDownloadUrl(f.file_key, f.filename),
    }))
  )

  return NextResponse.json({ gallery, files: filesWithUrls })
}
