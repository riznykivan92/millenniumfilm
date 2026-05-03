import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { r2 } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { checkAdminAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export const maxDuration = 60 // 60 seconds timeout

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const gallery_id = formData.get('gallery_id') as string

    if (!file || !gallery_id) {
      return NextResponse.json({ error: 'Missing file or gallery_id' }, { status: 400 })
    }

    const file_type = file.type.startsWith('video/') ? 'video' : 'photo'
    const ext = file.name.split('.').pop()
    const file_key = `${gallery_id}/${uuidv4()}.${ext}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload directly to R2 from server
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: file_key,
      Body: buffer,
      ContentType: file.type,
    }))

    // Save to Supabase
    const { data, error } = await supabaseAdmin()
      .from('files')
      .insert({
        gallery_id,
        filename: file.name,
        file_key,
        file_size: file.size,
        file_type,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ file: data })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
