import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUploadUrl } from '@/lib/r2'
import { checkAdminAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { gallery_id, filename, content_type, file_size } = await req.json()

  if (!gallery_id || !filename || !content_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Determine file type
  const file_type = content_type.startsWith('video/') ? 'video' : 'photo'

  // Generate unique key in R2
  const ext = filename.split('.').pop()
  const file_key = `${gallery_id}/${uuidv4()}.${ext}`

  // Get presigned upload URL from R2
  const upload_url = await getUploadUrl(file_key, content_type)

  // Save file record in Supabase
  const { data, error } = await supabaseAdmin()
    .from('files')
    .insert({ gallery_id, filename, file_key, file_size, file_type })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ file: data, upload_url })
}
