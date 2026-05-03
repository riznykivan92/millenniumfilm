export const dynamic = 'force-dynamic'

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

  const file_type = content_type.startsWith('video/') ? 'video' : 'photo'
  const ext = filename.split('.').pop()
  const file_key = `${gallery_id}/${uuidv4()}.${ext}`

  const upload_url = await getUploadUrl(file_key, content_type)

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
