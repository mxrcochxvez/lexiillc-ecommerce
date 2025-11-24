import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { updateCartItemQuantity, removeCartItem, getCart } from '../lib/cart-service'
import { getUserIdFromRequest } from '../lib/auth-helper'

export const Route = createFileRoute('/api/cart/$cartId/items/$itemId')({
  server: {
    handlers: {
      PUT: async ({ params, request }) => {
        try {
          const { cartId, itemId } = params
          const body = await request.json()
          const { quantity } = body

          if (quantity === undefined || quantity <= 0) {
            return json({ error: 'quantity must be greater than 0' }, { status: 400 })
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

          const item = await updateCartItemQuantity(cartId, itemId, quantity)

          return json(item)
        } catch (error) {
          console.error('Error updating cart item:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Return 400 for validation errors (limits exceeded, invalid input)
          const status = errorMessage.includes('cannot exceed') || 
                        errorMessage.includes('must be') || 
                        errorMessage.includes('not found')
                        ? 400 : 500
          
          return json(
            { error: 'Failed to update cart item', message: errorMessage },
            { status }
          )
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          const { cartId, itemId } = params

          // Verify cart belongs to user or session
          const cart = await getCart(cartId)
          if (!cart) {
            return json({ error: 'Cart not found' }, { status: 404 })
          }

          const userId = await getUserIdFromRequest(request)

          if (cart.userId && cart.userId !== userId) {
            return json({ error: 'Unauthorized' }, { status: 403 })
          }

          await removeCartItem(cartId, itemId)

          return json({ success: true })
        } catch (error) {
          console.error('Error removing cart item:', error)
          return json(
            { error: 'Failed to remove cart item', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
    },
  },
})

