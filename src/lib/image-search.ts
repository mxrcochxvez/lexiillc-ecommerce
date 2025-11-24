/**
 * Get environment variable (works in both server and client contexts)
 */
function getEnv(key: string): string | undefined {
  // Server-side: use process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  // Client-side: use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]
  }
  return undefined
}

const UNSPLASH_ACCESS_KEY = getEnv('VITE_UNSPLASH_ACCESS_KEY') || getEnv('UNSPLASH_ACCESS_KEY')
const UNSPLASH_API_URL = 'https://api.unsplash.com'

/**
 * Search for images using Unsplash API
 */
export async function searchImagesUnsplash(query: string): Promise<string[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('Unsplash API key not found, skipping image search')
    return []
  }

  try {
    // Build search query - focus on shoe/sneaker images
    const searchQuery = `${query} sneaker shoe`
    
    const response = await fetch(
      `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=square`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.results && Array.isArray(data.results)) {
      return data.results
        .map((result: { urls?: { regular?: string; small?: string } }) => 
          result.urls?.regular || result.urls?.small
        )
        .filter((url: string | undefined): url is string => !!url)
    }

    return []
  } catch (error) {
    console.error('Error searching images with Unsplash:', error)
    return []
  }
}

/**
 * Alternative: Use a free image search API or fallback
 * This is a placeholder for other image search services
 */
export async function searchImagesFree(query: string): Promise<string[]> {
  // For now, return empty array
  // Can be extended with other free image APIs
  return []
}

/**
 * Main function to search for product images
 * Tries Unsplash first, falls back to other services
 */
export async function searchProductImages(improvedName: string): Promise<string[]> {
  // Try Unsplash first
  if (UNSPLASH_ACCESS_KEY) {
    const unsplashResults = await searchImagesUnsplash(improvedName)
    if (unsplashResults.length > 0) {
      return unsplashResults
    }
  }

  // Try free alternatives
  const freeResults = await searchImagesFree(improvedName)
  if (freeResults.length > 0) {
    return freeResults
  }

  return []
}

