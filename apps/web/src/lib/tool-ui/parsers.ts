/**
 * Tool UI Parsers
 * Parse and validate Tool UI tool results at runtime
 */

import {
  SerializableDataTableSchema,
  SerializableLinkPreviewSchema,
  SerializableItemCarouselSchema,
  type SerializableDataTable,
  type SerializableLinkPreview,
  type SerializableItemCarousel,
} from './schemas';

/**
 * Convert raw product array to Tool UI Data Table format
 * Fallback for when backend returns raw array instead of Tool UI format
 */
function convertProductArrayToDataTable(products: any[]): SerializableDataTable {
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

  return {
    id: `product-search-${Date.now()}`,
    role: 'information' as const,
    title: 'Product Search Results',
    columns,
    rows,
    pagination: products.length > 0 ? {
      page: 1,
      pageSize: products.length,
      total: products.length,
    } : undefined,
  };
}

/**
 * Check if result is a raw product array
 * More specific checks to avoid false positives with employee data
 */
function isProductArray(result: any): boolean {
  if (!Array.isArray(result) || result.length === 0) {
    return false;
  }

  const firstItem = result[0];

  // Check for employee-specific fields first (to avoid false positives)
  if (firstItem.hasOwnProperty('full_name') ||
    firstItem.hasOwnProperty('candidate_id') ||
    firstItem.hasOwnProperty('skill') ||
    firstItem.hasOwnProperty('current_location') ||
    firstItem.hasOwnProperty('expected_ctc_numeric') ||
    firstItem.hasOwnProperty('stage') ||
    firstItem.hasOwnProperty('status')) {
    return false; // This is an employee array, not a product array
  }

  // Check for product-specific fields
  return (
    (firstItem.hasOwnProperty('name') || firstItem.hasOwnProperty('title')) &&
    (firstItem.hasOwnProperty('price') || firstItem.hasOwnProperty('category'))
  );
}

/**
 * Parse and validate a data table result
 */
export function parseSerializableDataTable(result: unknown): SerializableDataTable {
  try {
    // Handle case where result might be a JSON string
    let parsedResult = result;
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch (e) {
        console.error('Failed to parse JSON string:', e);
        throw new Error('Result is not valid JSON');
      }
    }

    // Log the result for debugging
    console.log('[parseSerializableDataTable] Parsing result:', parsedResult);
    console.log('[parseSerializableDataTable] Is array?', Array.isArray(parsedResult));

    // Fallback: If result is a raw product array, convert it
    if (isProductArray(parsedResult)) {
      console.log('[parseSerializableDataTable] Detected raw product array, converting to Tool UI format');
      return convertProductArrayToDataTable(parsedResult);
    }

    // Try to validate as Tool UI format
    try {
      const validated = SerializableDataTableSchema.parse(parsedResult);
      return validated;
    } catch (schemaError: any) {
      // If schema validation fails but it looks like a product array, convert it
      if (isProductArray(parsedResult)) {
        console.log('[parseSerializableDataTable] Schema validation failed, but detected product array - converting');
        return convertProductArrayToDataTable(parsedResult);
      }
      throw schemaError;
    }
  } catch (error: any) {
    console.error('Failed to parse data table:', error);
    console.error('Result that failed:', result);

    // Provide more detailed error message
    if (error?.issues) {
      const issues = error.issues.map((issue: any) =>
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`Invalid data table format: ${issues}`);
    }

    throw new Error(`Invalid data table format: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Parse and validate a link preview result
 */
export function parseSerializableLinkPreview(result: unknown): SerializableLinkPreview {
  try {
    return SerializableLinkPreviewSchema.parse(result);
  } catch (error) {
    console.error('Failed to parse link preview:', error);
    throw new Error('Invalid link preview format');
  }
}

/**
 * Check if result is a raw employee array
 */
function isEmployeeArray(result: any): boolean {
  if (!Array.isArray(result) || result.length === 0) {
    return false;
  }

  const firstItem = result[0];
  return !!(
    firstItem.hasOwnProperty('full_name') ||
    firstItem.hasOwnProperty('candidate_id') ||
    firstItem.hasOwnProperty('skill') ||
    firstItem.hasOwnProperty('current_location') ||
    firstItem.hasOwnProperty('expected_ctc_numeric') ||
    firstItem.hasOwnProperty('stage') ||
    firstItem.hasOwnProperty('status')
  );
}

/**
 * Convert raw employee array to Item Carousel format
 * Used when backend returns raw employee array instead of formatted ItemCarousel
 */
function convertEmployeeArrayToItemCarousel(employees: any[]): SerializableItemCarousel {
  const getStatusColor = (status?: string | null, stage?: string | null): string => {
    const statusLower = (status || '').toLowerCase();
    const stageLower = (stage || '').toLowerCase();

    if (statusLower.includes('reject') || stageLower.includes('drop')) {
      return '#ef4444'; // red
    }
    if (stageLower.includes('final select')) {
      return '#10b981'; // green
    }
    if (stageLower.includes('screening') || stageLower.includes('r1') || stageLower.includes('r2')) {
      return '#f59e0b'; // amber
    }
    if (stageLower.includes('submitted')) {
      return '#3b82f6'; // blue
    }
    return '#6366f1'; // indigo (default)
  };

  const items = employees.map((employee) => {
    const subtitleParts: string[] = [];
    if (employee.skill) subtitleParts.push(employee.skill);
    if (employee.overall_experience &&
      employee.overall_experience !== 'z' &&
      employee.overall_experience !== 'NIL') {
      subtitleParts.push(`${employee.overall_experience} exp`);
    }
    const subtitle = subtitleParts.join(' • ') ||
      employee.current_location ||
      employee.preferred_location ||
      undefined;

    const price = employee.expected_ctc_numeric ?? employee.current_ctc_numeric ?? undefined;
    const color = getStatusColor(employee.status, employee.stage);

    const actions = [
      {
        id: 'view_details',
        label: 'View Details',
        variant: 'secondary' as const,
      },
      {
        id: 'contact',
        label: 'Contact',
        variant: 'default' as const,
      },
    ];

    if (!employee.status?.toLowerCase().includes('reject') &&
      !employee.stage?.toLowerCase().includes('drop')) {
      actions.push({
        id: 'schedule_interview',
        label: 'Schedule Interview',
        variant: 'outline' as const,
      });
    }

    // Ensure we have a valid name - use candidate_id as fallback if full_name is missing
    const employeeName = employee.full_name ||
      (employee.candidate_id ? `Employee ${employee.candidate_id}` : null) ||
      (employee.id ? `Employee ${String(employee.id).substring(0, 8)}` : 'Employee');

    return {
      id: employee.candidate_id || employee.id,
      name: employeeName,
      subtitle,
      image: employee.resume_url || undefined,
      color,
      price,
      currency: 'INR',
      actions,
      // Include original employee data for dialog (same as server-side formatter)
      _employeeData: {
        ...employee, // Store full employee record for dialog
      },
    };
  });

  return {
    id: `employee-carousel-${Date.now()}`,
    role: 'information' as const,
    title: 'Employee Search Results',
    items,
  };
}

/**
 * Convert raw product array to Item Carousel format
 * Fallback for when backend returns raw array instead of Tool UI format
 */
function convertProductArrayToItemCarousel(products: any[]): SerializableItemCarousel {
  const items = products.map((product) => ({
    id: product.id || product.product_id || String(Math.random()),
    name: product.name || product.title || 'Unknown Product',
    subtitle: product.category || undefined,
    image: product.image || product.images?.[0],
    color: product.color || undefined,
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

  return {
    id: `product-carousel-${Date.now()}`,
    role: 'information' as const,
    title: 'Product Search Results',
    items,
  };
}

/**
 * Parse and validate an item carousel result
 */
export function parseSerializableItemCarousel(result: unknown): SerializableItemCarousel {
  try {
    // Handle case where result might be a JSON string
    let parsedResult = result;
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch (e) {
        console.error('Failed to parse JSON string:', e);
        throw new Error('Result is not valid JSON');
      }
    }

    // Log the result for debugging
    console.log('[parseSerializableItemCarousel] Parsing result:', parsedResult);
    console.log('[parseSerializableItemCarousel] Is array?', Array.isArray(parsedResult));

    // First, try to validate as Tool UI format (this is the expected format from backend)
    // The backend should already return properly formatted ItemCarousel from formatEmployeeSearchAsItemCarousel
    try {
      const validated = SerializableItemCarouselSchema.parse(parsedResult);
      console.log('[parseSerializableItemCarousel] Successfully validated as ItemCarousel format');
      return validated;
    } catch (schemaError: any) {
      // If validation fails, check if it's a raw array that needs conversion
      // Check for employee arrays FIRST (before products) to avoid misidentification
      if (Array.isArray(parsedResult) && isEmployeeArray(parsedResult)) {
        console.log('[parseSerializableItemCarousel] Detected raw employee array, converting to ItemCarousel format');
        return convertEmployeeArrayToItemCarousel(parsedResult);
      }

      // Only convert product arrays if it's confirmed to be products
      if (Array.isArray(parsedResult) && isProductArray(parsedResult)) {
        console.log('[parseSerializableItemCarousel] Schema validation failed, but detected raw product array - converting');
        return convertProductArrayToItemCarousel(parsedResult);
      }

      throw schemaError;
    }
  } catch (error: any) {
    console.error('Failed to parse item carousel:', error);
    console.error('Result that failed:', result);

    if (error?.issues) {
      const issues = error.issues.map((issue: any) =>
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`Invalid item carousel format: ${issues}`);
    }
    throw new Error(`Invalid item carousel format: ${error?.message || 'Unknown error'}`);
  }
}
