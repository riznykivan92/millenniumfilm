import { NextRequest } from 'next/server'

export function checkAdminAuth(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password')
  return auth === process.env.ADMIN_PASSWORD
}
