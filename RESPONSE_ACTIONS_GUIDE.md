# Response Actions Implementation Guide

This guide explains how Response Actions are implemented in the xerow.ai project using Tool UI.

## Overview

[Response Actions](https://www.tool-ui.com/docs/response-actions) are lightweight CTAs (Call To Actions) for human-in-the-loop decision points. They allow users to approve, reject, or take actions on AI-generated content directly from Tool UI components.

## Key Features

- **Serializable**: Actions can come from tool/LLM output
- **Variants**: Support for `default`, `secondary`, `ghost`, `destructive`, `outline`
- **Confirmation**: Destructive actions can require confirmation
- **Loading States**: Actions can show loading indicators
- **Keyboard Shortcuts**: Optional keyboard shortcuts for actions

## Implementation

### 1. Schema Definition

Response Actions are defined in `apps/web/src/lib/tool-ui/schemas.ts`:

```typescript
export const SerializableActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(['default', 'secondary', 'ghost', 'destructive', 'outline']).optional(),
  confirmLabel: z.string().optional(),
  disabled: z.boolean().optional(),
  loading: z.boolean().optional(),
  shortcut: z.string().optional(),
});

export const ResponseActionsSchema = z.union([
  z.array(SerializableActionSchema),
  z.object({
    items: z.array(SerializableActionSchema),
    align: z.enum(['left', 'right']).optional().default('right'),
    confirmTimeout: z.number().optional().default(3000),
  }),
]);
```

### 2. ResponseActions Component

The `ResponseActionsComponent` (`apps/web/src/components/tool-ui/ResponseActions.tsx`) handles:

- **Confirmation States**: Shows confirm label for destructive actions
- **Loading States**: Displays loading spinner during async operations
- **Alignment**: Supports left/right alignment
- **Timeout**: Auto-clears confirm state after timeout

### 3. Component Integration

Components like `DataTable` accept `responseActions` and handlers:

```typescript
<DataTable
  {...dataTable}
  responseActions={responseActions}
  onResponseAction={(actionId) => {
    // Handle action
  }}
  onBeforeResponseAction={(actionId) => {
    // Optional: Validate before action
    return true; // or false to cancel
  }}
/>
```

## Usage Examples

### Example 1: Product Search with Actions

**Backend** (`server/src/routes/tool-ui-helpers.ts`):

```typescript
const result = formatProductSearchAsDataTable(
  products,
  searchQuery,
  filters,
  true // includeResponseActions
);
```

This automatically adds:
- "Add All to Cart" (default variant)
- "Export" (secondary variant)

**Frontend** (`apps/web/src/components/tool-ui/tool-ui-registry.tsx`):

```typescript
const handleResponseAction = (actionId: string) => {
  if (actionId === 'add_all_to_cart') {
    // Add all products to cart
    productIds.forEach(id => onAddToCart(id));
  }
  if (actionId === 'export') {
    // Export products
    exportToCSV(products);
  }
};
```

### Example 2: Custom Actions with Confirmation

**Backend** (in tool result):

```typescript
{
  id: "flagged-expenses",
  role: "information",
  // ... table data ...
  responseActions: {
    items: [
      {
        id: "reject",
        label: "Reject All",
        variant: "destructive",
        confirmLabel: "Confirm Rejection"
      },
      {
        id: "approve",
        label: "Approve All",
        variant: "default",
        confirmLabel: "Confirm Approval"
      }
    ],
    align: "right",
    confirmTimeout: 3000
  }
}
```

**Frontend**:

```typescript
<DataTable
  {...dataTable}
  onResponseAction={(actionId) => {
    if (actionId === "approve") {
      submitExpenses();
    }
    if (actionId === "reject") {
      returnToSubmitter();
    }
  }}
/>
```

### Example 3: Array Format (Simple)

```typescript
responseActions: [
  { id: "edit", label: "Edit", variant: "secondary" },
  { id: "delete", label: "Delete", variant: "destructive", confirmLabel: "Confirm" },
  { id: "save", label: "Save", variant: "default" }
]
```

## Action Variants

| Variant | Use Case | Visual Style |
|---------|----------|--------------|
| `default` | Primary action | Primary button color |
| `secondary` | Secondary action | Secondary button color |
| `outline` | Tertiary action | Outlined button |
| `ghost` | Subtle action | Transparent background |
| `destructive` | Destructive action | Red/destructive color |

## Confirmation Flow

1. User clicks action with `confirmLabel`
2. Button text changes to `confirmLabel` (e.g., "Confirm Delete")
3. User clicks again within `confirmTimeout` (default 3000ms)
4. Action executes
5. If timeout expires, button reverts to original label

## Before Action Hook

Use `onBeforeResponseAction` to validate or prevent actions:

```typescript
onBeforeResponseAction={(actionId) => {
  if (actionId === 'delete' && !hasPermission()) {
    showError('Permission denied');
    return false; // Cancel action
  }
  return true; // Proceed
}}
```

## Backend Integration

### Adding Response Actions to Tool Results

**Option 1: Use helper function** (recommended):

```typescript
import { formatProductSearchAsDataTable } from './tool-ui-helpers';

const result = formatProductSearchAsDataTable(
  products,
  query,
  filters,
  true // includeResponseActions
);
```

**Option 2: Manual addition**:

```typescript
const result = {
  id: "my-tool-result",
  role: "information",
  // ... component data ...
  responseActions: {
    items: [
      { id: "action1", label: "Action 1", variant: "default" },
      { id: "action2", label: "Action 2", variant: "secondary" },
    ],
    align: "right",
  }
};
```

## Best Practices

1. **Limit Actions**: Default to 2-3 CTAs tied directly to content
2. **Use Confirmation**: Add `confirmLabel` for destructive or high-impact actions
3. **Keep Timeout Short**: Default 3000ms avoids stale confirm states
4. **Responsive Design**: Actions stack on narrow containers automatically
5. **Clear Labels**: Use action verbs (e.g., "Approve", "Reject", "Export")

## Component Support

Currently supported components:
- ✅ **DataTable**: Full support with response actions

Future components to support:
- Image (for image approval workflows)
- Link Preview (for link actions)
- Option List (for selection actions)
- Chart (for data export actions)

## Examples from Tool UI Docs

### DataTable: Flagged Expenses

```typescript
<DataTable
  id="flagged-expenses"
  // ... table config ...
  responseActions={{
    items: [
      { id: "reject", label: "Reject All", variant: "destructive", confirmLabel: "Confirm" },
      { id: "approve", label: "Approve All", variant: "default", confirmLabel: "Confirm" },
    ],
    align: "right",
  }}
  onResponseAction={(id) => {
    if (id === "approve") submitExpenses();
    if (id === "reject") returnToSubmitter();
  }}
/>
```

### Image: Generated Hero Image

```typescript
<Image
  id="generated-hero"
  // ... image config ...
  responseActions={[
    { id: "regenerate", label: "Try Again", variant: "secondary" },
    { id: "edit", label: "Edit Prompt", variant: "outline" },
    { id: "use", label: "Use This", variant: "default" },
  ]}
  onResponseAction={(id) => {
    if (id === "use") attachToPost(assetId);
    if (id === "regenerate") generateNewImage();
    if (id === "edit") openPromptEditor();
  }}
/>
```

## Testing

To test Response Actions:

1. **Enable in backend**: Set `includeResponseActions: true` in `formatProductSearchAsDataTable`
2. **Search for products**: Trigger `search_products` tool
3. **Verify actions appear**: Check that action buttons render below the table
4. **Test confirmation**: Click destructive action, verify confirm state
5. **Test handlers**: Verify actions trigger correct callbacks

## Resources

- [Tool UI Response Actions Docs](https://www.tool-ui.com/docs/response-actions)
- [Tool UI Overview](https://www.tool-ui.com/docs/overview)
- [Tool UI Quick Start](https://www.tool-ui.com/docs/quick-start)
