# Tool UI Implementation Guide

This document explains how Tool UI has been integrated into the xerow.ai project and how to extend it.

## Overview

[Tool UI](https://www.tool-ui.com/docs/overview) is a React component framework for **conversation-native** UIs. It provides:

- **Schema-first rendering**: Tools return JSON matching schemas; components render consistently
- **Assistant-anchored**: The assistant introduces, interprets, and closes each surface
- **Type safety**: Serializable schemas on the server, parsers on the client
- **Lifecycle aware**: Clear phases from invocation through receipt

## Architecture

### Current Setup

1. **Backend** (`server/src/routes/chat.ts`):
   - Tools return Tool UI-compliant JSON schemas
   - Helper functions format tool results (see `tool-ui-helpers.ts`)

2. **Frontend** (`apps/web/src/components/tool-ui/`):
   - Tool UI components registered using `makeAssistantToolUI`
   - Schemas defined in `lib/tool-ui/schemas.ts`
   - Parsers validate tool results at runtime

3. **Integration** (`apps/web/src/app/components/assistant-ui/Chat.tsx`):
   - Tool UI components registered in `AssistantRuntimeProvider`
   - Works alongside existing custom tool widgets

## Key Concepts

### 1. Tool UI Schema Structure

Every Tool UI surface follows this structure:

```typescript
{
  id: string;                    // Stable identifier for this rendering
  role: "information" | "decision" | "control" | "state" | "composite";
  title?: string;
  description?: string;
  actions?: Array<{
    id: string;
    label: string;
    sentence: string;  // Natural language description for assistant
  }>;
  receipt?: {
    outcome: "success" | "partial" | "failed" | "cancelled";
    summary: string;
    identifiers?: Record<string, string>;
    at: string;  // ISO timestamp
  };
  // Component-specific fields...
}
```

### 2. Component Registration

Tool UI components are registered using `makeAssistantToolUI`:

```typescript
export const ProductSearchToolUI = makeAssistantToolUI({
  toolName: 'search_products',  // Must match backend tool name
  render: ({ result }) => {
    if (result === undefined) {
      return <LoadingState />;
    }
    const data = parseSerializableDataTable(result);
    return <DataTable {...data} />;
  },
});
```

### 3. Backend Tool Format

Backend tools should return Tool UI-compliant JSON:

```typescript
// In server/src/routes/chat.ts
if (functionName === 'search_products') {
  const products = await searchProducts(functionArgs);
  toolResult = formatProductSearchAsDataTable(
    products,
    functionArgs.query,
    { category, minPrice, maxPrice }
  );
}
```

## Implementation Details

### Files Created

1. **`apps/web/src/lib/tool-ui/schemas.ts`**
   - Zod schemas for Tool UI components
   - Type definitions for type safety

2. **`apps/web/src/lib/tool-ui/parsers.ts`**
   - Runtime parsers that validate tool results
   - Throws errors for invalid data

3. **`apps/web/src/components/tool-ui/DataTable.tsx`**
   - Data Table component implementation
   - Renders tabular data with columns and rows

4. **`apps/web/src/components/tool-ui/tool-ui-registry.tsx`**
   - Registers all Tool UI components
   - Exports array for easy mounting

5. **`server/src/routes/tool-ui-helpers.ts`**
   - Helper functions to format tool results
   - Converts raw data to Tool UI schemas

### Files Modified

1. **`server/src/routes/chat.ts`**
   - Updated `search_products` to return Tool UI format
   - Imports `formatProductSearchAsDataTable` helper

2. **`apps/web/src/app/components/assistant-ui/Chat.tsx`**
   - Registers Tool UI components in `AssistantRuntimeProvider`
   - Components are mounted alongside Thread

## Adding New Tool UI Components

### Step 1: Define Schema

Add a schema in `apps/web/src/lib/tool-ui/schemas.ts`:

```typescript
export const MyToolUISchema = BaseToolUISchema.extend({
  role: z.literal('information'),
  // Add component-specific fields
  data: z.array(z.any()),
});
```

### Step 2: Create Parser

Add a parser in `apps/web/src/lib/tool-ui/parsers.ts`:

```typescript
export function parseMyToolUI(result: unknown): MyToolUI {
  return MyToolUISchema.parse(result);
}
```

### Step 3: Create Component

Create component in `apps/web/src/components/tool-ui/MyComponent.tsx`:

```typescript
export function MyComponent({ id, data, ...props }: MyToolUI) {
  return (
    <Card>
      {/* Render component */}
    </Card>
  );
}
```

### Step 4: Register Component

Add to `apps/web/src/components/tool-ui/tool-ui-registry.tsx`:

```typescript
export const MyToolUI = makeAssistantToolUI({
  toolName: 'my_tool',
  render: ({ result }) => {
    if (result === undefined) return <LoadingState />;
    const data = parseMyToolUI(result);
    return <MyComponent {...data} />;
  },
});

export const ToolUIComponents = [
  ProductSearchToolUI,
  MyToolUI,  // Add here
];
```

### Step 5: Update Backend

Update backend tool to return Tool UI format:

```typescript
// In server/src/routes/chat.ts
if (functionName === 'my_tool') {
  const rawData = await myToolFunction(functionArgs);
  toolResult = {
    id: `my-tool-${Date.now()}`,
    role: 'information',
    data: rawData,
    // ... other fields
  };
}
```

## Available Tool UI Components

Tool UI provides many pre-built components. See the [Gallery](https://www.tool-ui.com/docs/gallery):

- **Data Table**: Tabular data (✅ implemented)
- **Link Preview**: URL preview cards
- **Image/Image Gallery**: Image displays
- **Option List**: User selection lists
- **Chart**: Data visualization
- **Code Block**: Syntax-highlighted code
- **Order Summary**: Purchase summaries
- **Social Posts**: Social media content
- And more...

## Benefits of Tool UI

1. **Consistency**: All tools render with the same patterns
2. **Type Safety**: Schemas ensure data structure correctness
3. **Accessibility**: Components follow accessibility standards
4. **Referenceable**: Assistant can reference surfaces ("the second row")
5. **Lifecycle Management**: Clear states from invocation to receipt

## Migration Path

The current implementation supports both:
- **Tool UI components** (new, recommended)
- **Custom tool widgets** (existing, still works)

You can migrate tools one at a time:

1. Update backend to return Tool UI format
2. Create Tool UI component
3. Register in `tool-ui-registry.tsx`
4. Test and verify
5. Remove old custom widget (optional)

## Next Steps

1. **Add more Tool UI components**:
   - Link Preview for product links
   - Image Gallery for product images
   - Option List for user selections

2. **Enhance existing components**:
   - Add actions to Data Table (e.g., "Add to Cart")
   - Add receipts after side effects

3. **Create frontend tools**:
   - Use `makeAssistantTool` for interactive tools
   - See Tool UI docs for frontend tool examples

## Response Actions

Response Actions are lightweight CTAs for human-in-the-loop decision points. They've been fully implemented in the Tool UI components.

**Key Features:**
- Serializable actions from tool/LLM output
- Multiple button variants (default, secondary, destructive, etc.)
- Confirmation states for destructive actions
- Loading states during async operations
- Keyboard shortcuts support

**See:** [RESPONSE_ACTIONS_GUIDE.md](./RESPONSE_ACTIONS_GUIDE.md) for complete documentation and examples.

## Resources

- [Tool UI Overview](https://www.tool-ui.com/docs/overview)
- [Tool UI Quick Start](https://www.tool-ui.com/docs/quick-start)
- [Tool UI Response Actions](https://www.tool-ui.com/docs/response-actions)
- [Tool UI Gallery](https://www.tool-ui.com/docs/gallery)
- [UI Guidelines](https://www.tool-ui.com/docs/ui-guidelines)

## Example: Product Search Tool UI

The `search_products` tool now returns a Data Table:

**Backend** (`server/src/routes/chat.ts`):
```typescript
toolResult = formatProductSearchAsDataTable(products, query, filters);
```

**Frontend** (`apps/web/src/components/tool-ui/tool-ui-registry.tsx`):
```typescript
export const ProductSearchToolUI = makeAssistantToolUI({
  toolName: 'search_products',
  render: ({ result }) => {
    if (result === undefined) return <LoadingState />;
    const data = parseSerializableDataTable(result);
    return <DataTable {...data} />;
  },
});
```

**Registration** (`apps/web/src/app/components/assistant-ui/Chat.tsx`):
```typescript
<AssistantRuntimeProvider runtime={runtime}>
  {ToolUIComponents.map((Component, index) => (
    <Component key={index} />
  ))}
  <Thread />
</AssistantRuntimeProvider>
```

This creates a consistent, type-safe, and assistant-referenceable product search experience!
