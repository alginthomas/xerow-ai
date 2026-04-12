/**
 * Tool UI Helpers
 * Convert tool results to Tool UI schema-compliant format
 * See: https://www.tool-ui.com/docs/overview
 */

/**
 * Convert product search results to Tool UI Data Table format
 * @param includeResponseActions - Whether to include response actions (e.g., "Add All to Cart")
 */
export function formatProductSearchAsDataTable(
  products: any[],
  searchQuery?: string,
  filters?: { category?: string; minPrice?: number; maxPrice?: number },
  includeResponseActions: boolean = false
): any {
  const columns = [
    { id: 'image', label: 'Image', type: 'image' as const, align: 'center' as const },
    { id: 'name', label: 'Product', type: 'text' as const },
    { id: 'category', label: 'Category', type: 'badge' as const },
    { id: 'price', label: 'Price', type: 'currency' as const, align: 'right' as const },
    { id: 'stock', label: 'Stock', type: 'number' as const, align: 'center' as const },
  ];

  const rows = products.map((product) => ({
    id: product.id || product.product_id || String(Math.random()),
    cells: {
      image: product.image || product.images?.[0] || '',
      name: product.name || product.title || 'Unknown Product',
      category: product.category || 'Uncategorized',
      price: parseFloat(product.price) || 0,
      stock: product.stock || 0,
    },
  }));

  // Build title with search context
  let title = 'Product Search Results';
  if (searchQuery) {
    const capitalizedQuery = searchQuery
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    title = `Search Results for "${capitalizedQuery}"`;
  }

  // Build description with filters
  const filterParts: string[] = [];
  if (filters?.category) filterParts.push(`Category: ${filters.category}`);
  if (filters?.minPrice) filterParts.push(`Min: $${filters.minPrice}`);
  if (filters?.maxPrice) filterParts.push(`Max: $${filters.maxPrice}`);
  const description = filterParts.length > 0 ? filterParts.join(', ') : undefined;

  const result: any = {
    id: `product-search-${Date.now()}`,
    role: 'information' as const,
    title,
    description,
    columns,
    rows,
    pagination: products.length > 0 ? {
      page: 1,
      pageSize: products.length,
      total: products.length,
    } : undefined,
  };

  // Add response actions if requested
  if (includeResponseActions && products.length > 0) {
    result.responseActions = {
      items: [
        {
          id: 'add_all_to_cart',
          label: 'Add All to Cart',
          variant: 'default',
        },
        {
          id: 'export',
          label: 'Export',
          variant: 'secondary',
        },
      ],
      align: 'right',
      confirmTimeout: 3000,
    };
  }

  return result;
}

/**
 * Convert product search results to Tool UI Item Carousel format
 * See: https://www.tool-ui.com/docs/item-carousel
 */
export function formatProductSearchAsItemCarousel(
  products: any[],
  searchQuery?: string,
  filters?: { category?: string; minPrice?: number; maxPrice?: number }
): any {
  const items = products.map((product) => ({
    id: product.id || product.product_id || String(Math.random()),
    name: product.name || product.title || 'Unknown Product',
    subtitle: product.category || undefined,
    image: product.image || product.images?.[0],
    color: product.color || undefined, // Can be extracted from product if available
    price: product.price !== undefined && product.price !== null ? parseFloat(product.price) : undefined,
    currency: product.currency || 'INR', // Default to INR (Indian Rupees) based on application context
    actions: [
      {
        id: 'view',
        label: 'View Details',
        variant: 'secondary' as const,
      },
      {
        id: 'add_to_cart',
        label: 'Add to Cart',
        variant: 'default' as const,
      },
    ],
  }));

  // Build title with search context
  let title = 'Product Search Results';
  if (searchQuery) {
    const capitalizedQuery = searchQuery
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    title = `Search Results for "${capitalizedQuery}"`;
  }

  // Build description with filters
  const filterParts: string[] = [];
  if (filters?.category) filterParts.push(`Category: ${filters.category}`);
  if (filters?.minPrice) filterParts.push(`Min: $${filters.minPrice}`);
  if (filters?.maxPrice) filterParts.push(`Max: $${filters.maxPrice}`);
  const description = filterParts.length > 0 ? filterParts.join(', ') : undefined;

  return {
    id: `product-carousel-${Date.now()}`,
    role: 'information' as const,
    title,
    description,
    items,
  };
}

/**
 * Add receipt to Tool UI result after side effects
 */
export function addReceiptToToolUIResult(
  result: any,
  outcome: 'success' | 'partial' | 'failed' | 'cancelled',
  summary: string,
  identifiers?: Record<string, string>
): any {
  return {
    ...result,
    receipt: {
      outcome,
      summary,
      identifiers,
      at: new Date().toISOString(),
    },
  };
}
