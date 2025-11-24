import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { addItemToCart, getCart } from '../lib/cart-service'
import { getUserIdFromRequest } from '../lib/auth-helper'

export const Route = createFileRoute('/api/cart/$cartId/items')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          const { cartId } = params
          const body = await request.json()
          const { productId, quantity = 1 } = body

          if (!productId) {
            return json({ error: 'productId is required' }, { status: 400 })
          }

          // Verify cart belongs to user or session
          const cart = await getCart(cartId)
          if (!cart) {
            return json({ error: 'Cart not found' }, { status: 404 })
          }

          const userId = await getUserIdFromRequest(request)

          if (cart.userId && cart.userId !== userId) {
            return json({ error: 'Unauthorized' }, { status: 403 })
          }

          const item = await addItemToCart(cartId, productId, quantity)

          return json(item)
        } catch (error) {
          console.error('Error adding item to cart:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Return 400 for validation errors (limits exceeded, invalid input)
          const status = errorMessage.includes('cannot exceed') || 
                        errorMessage.includes('must be') || 
                        errorMessage.includes('not found') 
                        ? 400 : 500
          
          return json(
            { error: 'Failed to add item to cart', message: errorMessage },
            { status }
          )
        }
      },
    },
  },
})

