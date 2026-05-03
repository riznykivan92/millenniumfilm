export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteFile } from '@/lib/r2'
import { checkAdminAuth } from '@/lib/auth'

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { file_ids } = await req.json()

  const { data: files } = await supabaseAdmin()
    .from('files')
    .select('id, file_key')
    .in('id', file_ids)

  if (!files?.length) return NextResponse.json({ ok: true })

  await Promise.all(files.map(f => deleteFile(f.file_key)))

  await supabaseAdmin().from('files').delete().in('id', file_ids)

  return NextResponse.json({ ok: true })
}
