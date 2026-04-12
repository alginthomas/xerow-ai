/**
 * Tool UI Schemas
 * Define schemas for Tool UI components following the Tool UI specification
 * See: https://www.tool-ui.com/docs/overview
 */

import { z } from 'zod';

/**
 * Response Action schema
 * Lightweight CTAs for human-in-the-loop decision points
 * See: https://www.tool-ui.com/docs/response-actions
 */
export const SerializableActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(['default', 'secondary', 'ghost', 'destructive', 'outline']).optional(),
  confirmLabel: z.string().optional(),
  disabled: z.boolean().optional(),
  loading: z.boolean().optional(),
  shortcut: z.string().optional(),
});

export type SerializableAction = z.infer<typeof SerializableActionSchema>;

/**
 * Response Actions configuration
 * Can be array or object with layout config
 */
export const ResponseActionsSchema = z.union([
  z.array(SerializableActionSchema),
  z.object({
    items: z.array(SerializableActionSchema),
    align: z.enum(['left', 'right']).optional().default('right'),
    confirmTimeout: z.number().optional().default(3000),
  }),
]);

export type ResponseActions = z.infer<typeof ResponseActionsSchema>;

/**
 * Base Tool UI schema structure
 * Every Tool UI surface must have an id and role
 */
export const BaseToolUISchema = z.object({
  id: z.string(),
  role: z.enum(['information', 'decision', 'control', 'state', 'composite']),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    sentence: z.string(),
  })).optional(),
  responseActions: ResponseActionsSchema.optional(),
  receipt: z.object({
    outcome: z.enum(['success', 'partial', 'failed', 'cancelled']),
    summary: z.string(),
    identifiers: z.record(z.string()).optional(),
    at: z.string(), // ISO timestamp
  }).optional(),
});

/**
 * Progress Tracker Step schema
 * See: https://www.tool-ui.com/docs/progress-tracker
 */
export const ProgressStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed']),
});

export type ProgressStep = z.infer<typeof ProgressStepSchema>;

/**
 * Progress Tracker schema
 * See: https://www.tool-ui.com/docs/progress-tracker
 */
export const SerializableProgressTrackerSchema = BaseToolUISchema.extend({
  role: z.literal('state').default('state'),
  steps: z.array(ProgressStepSchema),
  elapsedTime: z.number().optional(), // Milliseconds
});

export type SerializableProgressTracker = z.infer<typeof SerializableProgressTrackerSchema>;

/**
 * Data Table schema for product search results
 * See: https://www.tool-ui.com/docs/components/data-table
 */
export const SerializableDataTableSchema = BaseToolUISchema.extend({
  role: z.literal('information').default('information'), // Make role optional with default
  title: z.string().optional(),
  description: z.string().optional(),
  columns: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'currency', 'image', 'badge', 'action']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  })),
  rows: z.array(z.object({
    id: z.string(),
    cells: z.record(z.any()),
  })),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }).optional(),
  // responseActions is inherited from BaseToolUISchema
}).passthrough(); // Allow extra fields for flexibility

export type SerializableDataTable = z.infer<typeof SerializableDataTableSchema>;

/**
 * Product Search Tool UI Schema
 * Returns a data table with product search results
 */
export const ProductSearchToolUISchema = SerializableDataTableSchema.extend({
  id: z.string().default('product-search-results'),
  role: z.literal('information'),
  title: z.string().default('Product Search Results'),
});

export type ProductSearchToolUI = z.infer<typeof ProductSearchToolUISchema>;

/**
 * Link Preview schema (example from Tool UI docs)
 */
export const SerializableLinkPreviewSchema = BaseToolUISchema.extend({
  role: z.literal('information'),
  href: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  siteName: z.string().optional(),
});

export type SerializableLinkPreview = z.infer<typeof SerializableLinkPreviewSchema>;

/**
 * Item Carousel Item schema
 * See: https://www.tool-ui.com/docs/item-carousel
 */
export const ItemCarouselItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string().optional(),
  image: z.string().url().optional(),
  color: z.string().optional(), // Hex color for fallback
  price: z.number().optional(), // Price as a number
  currency: z.string().optional().default('INR'), // Currency code (e.g., 'USD', 'INR', 'EUR') - defaults to INR
  actions: z.array(SerializableActionSchema).optional(),
}).passthrough(); // Allow extra fields like _employeeData for detail dialogs

export type ItemCarouselItem = z.infer<typeof ItemCarouselItemSchema>;

/**
 * Item Carousel schema
 * See: https://www.tool-ui.com/docs/item-carousel
 */
export const SerializableItemCarouselSchema = BaseToolUISchema.extend({
  role: z.literal('information').default('information'),
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.array(ItemCarouselItemSchema),
});

export type SerializableItemCarousel = z.infer<typeof SerializableItemCarouselSchema>;

/**
 * Citation schema
 * See: https://www.tool-ui.com/docs/citation
 */
export const SerializableCitationSchema = z.object({
  id: z.string(),
  href: z.string().url(),
  title: z.string(),
  snippet: z.string().optional(),
  domain: z.string().optional(),
  favicon: z.string().url().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  type: z.enum(['webpage', 'document', 'article', 'api', 'code', 'other']).optional(),
});

export type SerializableCitation = z.infer<typeof SerializableCitationSchema>;

/**
 * Web Search Results schema
 * Contains an array of citations from web search
 */
export const SerializableWebSearchResultsSchema = BaseToolUISchema.extend({
  role: z.literal('information').default('information'),
  title: z.string().optional().default('Web Search Results'),
  description: z.string().optional(),
  citations: z.array(SerializableCitationSchema),
  variant: z.enum(['default', 'inline', 'stacked']).optional().default('default'),
});

export type SerializableWebSearchResults = z.infer<typeof SerializableWebSearchResultsSchema>;
