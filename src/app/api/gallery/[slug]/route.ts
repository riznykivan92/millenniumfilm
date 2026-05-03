import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  // Get gallery
  const { data: gallery, error: gError } = await supabaseAdmin()
    .from('galleries')
    .select('*')
    .eq('slug', slug)
    .single()

  if (gError || !gallery) {
    return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })
  }

  // Check expiry
  if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Gallery expired' }, { status: 410 })
  }

  // Get files
  const { data: files, error: fError } = await supabaseAdmin()
    .from('files')
    .select('*')
    .eq('gallery_id', gallery.id)
    .order('created_at', { ascending: true })

  if (fError) {
    return NextResponse.json({ error: fError.message }, { status: 500 })
  }

  // Generate signed download URLs for each file
  const filesWithUrls = await Promise.all(
    (files || []).map(async (f) => ({
      ...f,
      download_url: await getDownloadUrl(f.file_key, f.filename),
    }))
  )

  return NextResponse.json({ gallery, files: filesWithUrls })
}
