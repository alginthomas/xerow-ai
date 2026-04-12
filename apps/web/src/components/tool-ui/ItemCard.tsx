/**
 * Item Card Component (Tool UI)
 * Individual card for Item Carousel
 * See: https://www.tool-ui.com/docs/item-carousel
 */

import React from 'react';
import { Card } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Checkbox } from '../../app/components/ui/checkbox';
import type { ItemCarouselItem } from '../../lib/tool-ui/schemas';

interface ItemCardProps {
  item: ItemCarouselItem;
  onItemClick?: (itemId: string) => void;
  onItemAction?: (itemId: string, actionId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (itemId: string) => void;
}

export function ItemCard({ item, onItemClick, onItemAction, isSelected = false, onToggleSelect }: ItemCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on a button or checkbox
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('[data-slot="checkbox"]')) {
      return;
    }
    onItemClick?.(item.id);
  };

  const handleActionClick = (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    onItemAction?.(item.id, actionId);
  };

  const handleToggleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // This is now handled by the checkbox's onCheckedChange
  };

  const getButtonVariant = (variant?: string): "default" | "secondary" | "destructive" | "outline" | "ghost" => {
    switch (variant) {
      case 'destructive':
        return 'destructive';
      case 'secondary':
        return 'secondary';
      case 'outline':
        return 'outline';
      case 'ghost':
        return 'ghost';
      default:
        return 'default';
    }
  };

  // Format price with currency
  const formatPrice = (price?: number, currency?: string): string => {
    if (price === undefined || price === null) return '';
    
    const currencyCode = currency || 'INR'; // Default to INR (Indian Rupees)
    const currencySymbols: Record<string, string> = {
      'USD': '$',
      'INR': '₹',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
    };
    
    const symbol = currencySymbols[currencyCode] || currencyCode;
    
    // Format number with commas
    const formattedNumber = price.toLocaleString('en-US', {
      minimumFractionDigits: currencyCode === 'INR' ? 0 : 2,
      maximumFractionDigits: currencyCode === 'INR' ? 0 : 2,
    });
    
    return `${symbol}${formattedNumber}`;
  };

  return (
    <Card
      className="flex flex-col h-full w-full min-w-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all border-border bg-card relative"
      onClick={handleCardClick}
    >
      {/* Selection Checkbox */}
      {onToggleSelect && (
        <div
          className="absolute top-2 right-2 z-20"
          onClick={(e) => {
            e.stopPropagation();
            // Don't handle click here - let the checkbox handle it
          }}
          role="none"
          aria-hidden="true"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              // Always toggle when checked changes (handles both select and deselect)
              onToggleSelect(item.id);
            }}
            className="h-4 w-4 rounded-full border-2 border-white/90 bg-black/50 backdrop-blur-md data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-lg hover:border-white hover:bg-black/60 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer [&[data-state=checked]_[data-slot=checkbox-indicator]]:text-black [&[data-state=checked]_[data-slot=checkbox-indicator]_svg]:text-black [&[data-state=checked]_[data-slot=checkbox-indicator]_svg]:stroke-[3.5]"
            aria-label={isSelected ? `Remove ${item.name} from comparison. Currently selected.` : `Add ${item.name} to comparison`}
            aria-checked={isSelected}
            id={`checkbox-${item.id}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelect(item.id);
              }
            }}
          />
        </div>
      )}

      {/* Image or Color Background */}
      <div
        className="w-full aspect-square relative overflow-hidden bg-muted flex-shrink-0"
        style={{
          backgroundColor: item.color || undefined,
        }}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white text-4xl font-bold bg-gradient-to-br from-muted to-muted/50"
            style={{ backgroundColor: item.color || undefined }}
          >
            {item.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3 min-h-0">
        <div className="flex-1 min-h-0">
          <h3 className="font-semibold text-base leading-tight mb-1.5 line-clamp-2">{item.name}</h3>
          {item.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-1">{item.subtitle}</p>
          )}
          {item.price !== undefined && item.price !== null && (
            <p className="text-base font-semibold text-foreground mt-1.5">
              {formatPrice(item.price, item.currency)}
            </p>
          )}
        </div>

        {/* Actions */}
        {item.actions && item.actions.length > 0 && (
          <div className="flex flex-row gap-2 mt-auto pt-2">
            {item.actions.map((action) => (
              <Button
                key={action.id}
                variant={getButtonVariant(action.variant)}
                size="sm"
                className="flex-1 rounded-full text-xs"
                onClick={(e) => handleActionClick(e, action.id)}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
