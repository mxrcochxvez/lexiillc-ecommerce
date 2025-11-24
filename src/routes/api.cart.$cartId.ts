import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getCart, clearCart } from '../lib/cart-service'
import { getUserIdFromRequest } from '../lib/auth-helper'

export const Route = createFileRoute('/api/cart/$cartId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const { cartId } = params
          const cart = await getCart(cartId)

          if (!cart) {
            return json({ error: 'Cart not found' }, { status: 404 })
          }

          // Verify cart belongs to user or session
          const userId = await getUserIdFromRequest(request)

          if (cart.userId && cart.userId !== userId) {
            return json({ error: 'Unauthorized' }, { status: 403 })
          }

          return json(cart)
        } catch (error) {
          console.error('Error fetching cart:', error)
          return json(
            { error: 'Failed to fetch cart', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          const { cartId } = params
          const cart = await getCart(cartId)

          if (!cart) {
            return json({ error: 'Cart not found' }, { status: 404 })
          }

          // Verify cart belongs to user or session
          const userId = await getUserIdFromRequest(request)

          if (cart.userId && cart.userId !== userId) {
            return json({ error: 'Unauthorized' }, { status: 403 })
          }

          await clearCart(cartId)

          return json({ success: true })
        } catch (error) {
          console.error('Error clearing cart:', error)
          return json(
            { error: 'Failed to clear cart', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
    },
  },
})

