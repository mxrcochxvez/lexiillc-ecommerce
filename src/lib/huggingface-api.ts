import { createServerFn } from '@tanstack/react-start'

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

const HUGGINGFACE_API_KEY = getEnv('VITE_HUGGINGFACE_API_KEY') || getEnv('HUGGINGFACE_API_KEY')
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models'

/**
 * Improve product name using HuggingFace text generation/translation model
 * This cleans up and normalizes shoe product names for better search results
 * Returns original name if API is unavailable or fails
 */
export async function improveProductNameServer(originalName: string): Promise<string> {
  if (!HUGGINGFACE_API_KEY) {
    // Silently skip if no API key
    return originalName
  }

  try {
    // Try using a more reliable model endpoint
    // Using a text-to-text model that's more likely to be available
    const response = await fetch(`${HUGGINGFACE_API_URL}/google/flan-t5-base`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `Normalize this shoe name: ${originalName}`,
      }),
      // Add timeout to avoid hanging
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // If model is unavailable (410, 404) or loading (503), just return original
      if ([404, 410, 503].includes(response.status)) {
        return originalName
      }
      // For other errors, log but don't throw
      console.warn(`HuggingFace API returned ${response.status}, skipping name improvement`)
      return originalName
    }

    const data = await response.json()
    
    // Extract the improved name from the response
    if (Array.isArray(data) && data[0]?.generated_text) {
      const improved = data[0].generated_text.trim()
      // Only use if it's different and not empty
      if (improved && improved !== originalName && improved.length > 0) {
        return improved
      }
    }

    return originalName
  } catch (error) {
    // Silently fail - don't log errors to avoid spam
    // Just return the original name
    return originalName
  }
}

/**
 * Alternative: Use a simpler text cleaning approach with HuggingFace
 * This uses a text-to-text model to clean up the name
 * Returns original name if API is unavailable or fails
 */
export async function cleanProductNameServer(originalName: string): Promise<string> {
  if (!HUGGINGFACE_API_KEY) {
    return originalName
  }

  try {
    // Use a text-to-text model like T5 for text cleaning
    const response = await fetch(`${HUGGINGFACE_API_URL}/google/flan-t5-base`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `clean text: ${originalName}`,
      }),
      // Add timeout to avoid hanging
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // If model is unavailable, just return original
      if ([404, 410, 503].includes(response.status)) {
        return originalName
      }
      return originalName
    }

    const data = await response.json()
    
    if (Array.isArray(data) && data[0]?.generated_text) {
      const cleaned = data[0].generated_text.trim()
      return cleaned || originalName
    }

    return originalName
  } catch (error) {
    // Silently fail - return original name
    return originalName
  }
}

/**
 * Main function to improve product name
 * Tries multiple approaches and returns the best result
 * Gracefully falls back to original name if HuggingFace is unavailable
 */
export async function improveProductName(originalName: string): Promise<string> {
  // If no API key, skip entirely
  if (!HUGGINGFACE_API_KEY) {
    return originalName
  }

  try {
    // Try the improvement approach first
    const improved = await improveProductNameServer(originalName)
    
    // If we got a valid improvement, use it
    if (improved && improved !== originalName && improved.length > 0) {
      return improved
    }

    // Fallback to original name
    return originalName
  } catch (error) {
    // Silently fail - return original name
    return originalName
  }
}

