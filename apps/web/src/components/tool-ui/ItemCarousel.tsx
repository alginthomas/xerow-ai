/**
 * Item Carousel Component (Tool UI)
 * Vertical scrollable grid for browsing collections of items
 * Displays items in a responsive grid that users can scroll down to view
 */

import React from 'react';
import { ItemCard } from './ItemCard';
import type { SerializableItemCarousel } from '../../lib/tool-ui/schemas';

interface ItemCarouselProps extends SerializableItemCarousel {
  className?: string;
  onItemClick?: (itemId: string) => void;
  onItemAction?: (itemId: string, actionId: string) => void;
  selectedItems?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
}

export function ItemCarousel({
  id,
  title,
  description,
  items,
  className,
  onItemClick,
  onItemAction,
  selectedItems,
  onToggleSelect,
}: ItemCarouselProps) {
  if (!items || items.length === 0) {
    return (
      <div className={`my-4 p-4 bg-card rounded-lg border ${className || ''}`}>
        <p className="text-sm text-muted-foreground">No items to display</p>
      </div>
    );
  }

  return (
    <div className={`my-4 w-full ${className || ''}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold mb-1">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Vertical scrollable grid - max 3 columns on large devices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {items.map((item) => (
          <div key={item.id} className="w-full min-w-0">
            <ItemCard
              item={item}
              onItemClick={onItemClick}
              onItemAction={onItemAction}
              isSelected={selectedItems?.has(item.id) || false}
              onToggleSelect={onToggleSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error boundary for Item Carousel
 */
export function ItemCarouselErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
