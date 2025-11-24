/**
 * Helper to get user ID from request
 * Works with Clerk authentication via cookies or headers
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    const { clerkClient } = await import('@clerk/backend')
    
    // Authenticate request - Clerk will handle both cookies and headers
    const auth = await clerkClient().authenticateRequest({
      request,
    })
    
    return auth?.userId || null
  } catch (error) {
    // Request is not authenticated or authentication failed
    // This is expected for unauthenticated users
    return null
  }
}

