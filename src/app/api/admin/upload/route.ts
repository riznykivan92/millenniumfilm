export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { r2 } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { checkAdminAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let file: File | null = null
  let gallery_id: string | null = null

  const contentType = req.headers.get('content-type') || ''
  
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    file = formData.get('file') as File
    gallery_id = formData.get('gallery_id') as string
  } else {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
  }

  if (!file || !gallery_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const file_type = file.type.startsWith('video/') ? 'video' : 'photo'
  const ext = file.name.split('.').pop()
  const file_key = `${gallery_id}/${uuidv4()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: file_key,
    Body: buffer,
    ContentType: file.type,
  }))

  const { data, error } = await supabaseAdmin()
    .from('files')
    .insert({ gallery_id, filename: file.name, file_key, file_size: file.size, file_type })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ file: data })
}
