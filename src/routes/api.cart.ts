import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getOrCreateCart, getCart } from '../lib/cart-service'
import { getUserIdFromRequest } from '../lib/auth-helper'

/**
 * Generate or retrieve a session ID for unauthenticated users
 */
function getSessionId(request: Request): string | null {
  // Try to get session ID from cookie
  const cookies = request.headers.get('cookie')
  if (cookies) {
    const sessionMatch = cookies.match(/sessionId=([^;]+)/)
    if (sessionMatch) {
      return sessionMatch[1]
    }
  }
  return null
}

/**
 * Generate a new session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

export const Route = createFileRoute('/api/cart')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request)
          
          // Check for cartId in query parameters (from localStorage)
          const url = new URL(request.url)
          const cartIdParam = url.searchParams.get('cartId')
          
          // If cartId is provided, try to get that cart first
          if (cartIdParam) {
            const existingCart = await getCart(cartIdParam)
            if (existingCart) {
              // Verify cart belongs to user or session
              const sessionId = getSessionId(request)
              const isAuthorized = 
                (userId && existingCart.userId === userId) ||
                (!userId && existingCart.sessionId === sessionId && !existingCart.userId)
              
              if (isAuthorized) {
                const headers = new Headers()
                // Ensure sessionId cookie is set if not authenticated
                if (!userId && existingCart.sessionId) {
                  headers.set(
                    'Set-Cookie',
                    `sessionId=${existingCart.sessionId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
                  )
                }
                return json(existingCart, { headers })
              }
            }
          }

          // Get or create cart using userId and sessionId
          let sessionId = getSessionId(request)
          if (!sessionId && !userId) {
            // Generate new sessionId for unauthenticated users
            sessionId = generateSessionId()
          }

          const cart = await getOrCreateCart(userId, sessionId)

          // Set session cookie if user is not authenticated
          const headers = new Headers()
          if (!userId && sessionId) {
            headers.set(
              'Set-Cookie',
              `sessionId=${sessionId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
            )
          }

          return json(cart, { headers })
        } catch (error) {
          console.error('Error fetching cart:', error)
          return json(
            { error: 'Failed to fetch cart', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request)
          let sessionId = getSessionId(request)
          
          // Generate sessionId if not present and user is not authenticated
          if (!sessionId && !userId) {
            sessionId = generateSessionId()
          }

          const cart = await getOrCreateCart(userId, sessionId)

          const headers = new Headers()
          if (!userId && sessionId) {
            headers.set(
              'Set-Cookie',
              `sessionId=${sessionId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
            )
          }

          return json(cart, { headers })
        } catch (error) {
          console.error('Error creating cart:', error)
          return json(
            { error: 'Failed to create cart', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
    },
  },
})

