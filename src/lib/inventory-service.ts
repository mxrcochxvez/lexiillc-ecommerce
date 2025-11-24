import { fetchCloverInventoryServer } from './clover-api'
import { searchSneaksAPIServer, findBestMatch } from './sneaks-api'
import { parseShoeName } from './shoe-parser'
import { getCachedRawInventory, setCachedRawInventory, getCachedEnrichment, setCachedEnrichment } from './inventory-cache'
import { improveProductName } from './huggingface-api'
import { searchProductImages } from './image-search'
import type { EnrichedInventoryItem } from '../types/inventory'
import type { CloverItem } from '../types/inventory'

/**
 * Get raw Clover inventory (fast, no enrichment)
 */
export async function getRawInventory(): Promise<CloverItem[]> {
  // Check cache first
  const cached = getCachedRawInventory()
  if (cached) {
    return cached
  }

  // Fetch from Clover
  const cloverItems = await fetchCloverInventoryServer()

  // Filter out items with $0 price, no price, or out of stock
  const validItems = cloverItems.filter((item) => {
    const hasValidPrice = item.price !== undefined && item.price !== null && item.price > 0
    const isInStock = item.stockCount === undefined || item.stockCount === null || item.stockCount > 0
    return hasValidPrice && isInStock
  })

  // Cache raw items
  setCachedRawInventory(validItems)

  return validItems
}

/**
 * Enrich a batch of items (for pagination)
 */
export async function enrichItemsBatch(items: CloverItem[]): Promise<EnrichedInventoryItem[]> {
  const batchSize = 10
  const enrichedItems: EnrichedInventoryItem[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchPromises = batch.map(async (item) => {
      // Check if already enriched and cached
      const cached = getCachedEnrichment(item.id)
      if (cached) {
        return cached
      }

      try {
        const enriched = await enrichInventoryItem(item)
        // Cache the enriched item
        setCachedEnrichment(item.id, enriched)
        return enriched
      } catch (error) {
        // Gracefully handle any errors - return item without enrichment
        const fallback = createFallbackItem(item)
        setCachedEnrichment(item.id, fallback)
        return fallback
      }
    })

    const batchResults = await Promise.all(batchPromises)
    enrichedItems.push(...batchResults)

    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return enrichedItems
}

/**
 * Main service that orchestrates Clover fetch, parsing, and Sneaks API lookup
 * NOTE: This enriches ALL items - use getRawInventory + enrichItemsBatch for pagination
 */
export async function getEnrichedInventory(): Promise<EnrichedInventoryItem[]> {
  try {
    const rawItems = await getRawInventory()
    return await enrichItemsBatch(rawItems)
  } catch (error) {
    console.error('Error getting enriched inventory:', error)
    throw error
  }
}

/**
 * Enriches a single inventory item with KicksDB data, HuggingFace name improvement, and image search
 */
async function enrichInventoryItem(
  item: { id: string; name: string; price?: number; stockCount?: number; [key: string]: unknown }
): Promise<EnrichedInventoryItem> {
  // Parse the shoe name
  const parsed = parseShoeName(item.name)

  // Improve product name using HuggingFace (if API key is available)
  // This is optional and will gracefully fail if HuggingFace is unavailable
  let improvedName = item.name
  let improvedSearchQuery = parsed.searchQuery
  
  // Try to improve the name, but don't let errors break the enrichment process
  try {
    improvedName = await improveProductName(item.name)
    // Only re-parse if we got a different name
    if (improvedName !== item.name) {
      const improvedParsed = parseShoeName(improvedName)
      improvedSearchQuery = improvedParsed.searchQuery || parsed.searchQuery
    }
  } catch (error) {
    // Silently continue with original name - HuggingFace is optional
  }

  // Search Sneaks API for matching products (free, no API key needed)
  const { products } = await searchSneaksAPIServer(improvedSearchQuery)

  // Find the best match
  const bestMatch = findBestMatch(improvedSearchQuery, products)

  // Try to get images from Unsplash if no match found or no images
  let imageUrl: string | undefined
  let images: string[] | undefined

  if (bestMatch) {
    // Extract image URL (prefer imageUrl, fallback to first image in images array)
    imageUrl =
      bestMatch.imageUrl ||
      (bestMatch.images && bestMatch.images.length > 0 ? bestMatch.images[0] : undefined)
    images = bestMatch.images
  }

  // If no images found from Sneaks API, try image search
  if (!imageUrl && !images) {
    try {
      const searchImages = await searchProductImages(improvedSearchQuery)
      if (searchImages.length > 0) {
        imageUrl = searchImages[0]
        images = searchImages
      }
    } catch (error) {
      console.warn(`Failed to search images for ${improvedSearchQuery}:`, error)
      // Continue without images
    }
  }

  if (bestMatch || imageUrl) {
    return {
      id: item.id,
      name: bestMatch?.name || improvedName || parsed.model || item.name,
      originalName: item.name,
      brand: parsed.brand || bestMatch?.brand || '',
      model: parsed.model || bestMatch?.model || '',
      size: parsed.size,
      price: item.price,
      stockCount: item.stockCount,
      imageUrl,
      images,
      colorway: bestMatch?.colorway,
      retailPrice: bestMatch?.retailPrice,
      releaseDate: bestMatch?.releaseDate,
      matched: true,
      searchQuery: improvedSearchQuery,
    }
  }

  // No match found - return item with parsed data but no image
  return {
    id: item.id,
    name: improvedName || item.name,
    originalName: item.name,
    brand: parsed.brand,
    model: parsed.model,
    size: parsed.size,
    price: item.price,
    stockCount: item.stockCount,
    matched: false,
    searchQuery: improvedSearchQuery,
  }
}

/**
 * Creates a fallback item when enrichment fails
 */
function createFallbackItem(item: {
  id: string
  name: string
  price?: number
  stockCount?: number
  [key: string]: unknown
}): EnrichedInventoryItem {
  const parsed = parseShoeName(item.name)

  return {
    id: item.id,
    name: item.name,
    originalName: item.name,
    brand: parsed.brand,
    model: parsed.model,
    size: parsed.size,
    price: item.price,
    stockCount: item.stockCount,
    matched: false,
    searchQuery: parsed.searchQuery,
  }
}

