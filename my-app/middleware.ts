import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the response
  const response = NextResponse.next()

  // Add the CORS headers to the response
  response.headers.set('Access-Control-Allow-Credentials', "true")
  response.headers.set('Access-Control-Allow-Origin', '*') // Replace * with your domain in production
  response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return response
}

// Configure which routes you want the middleware to run on
export const config = {
  matcher: '/api/:path*',
}