/**
 * Citation Component
 * Display source references with attribution for web search results
 * Based on Tool UI Citation component: https://www.tool-ui.com/docs/citation
 */

"use client";

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "../../app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../app/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../../app/components/ui/popover";
import { cn } from "../../app/components/ui/utils";

export interface SerializableCitation {
  id: string;
  href: string;
  title: string;
  snippet?: string;
  domain?: string;
  favicon?: string;
  author?: string;
  publishedAt?: string;
  type?: 'webpage' | 'document' | 'article' | 'api' | 'code' | 'other';
}

export interface CitationProps extends SerializableCitation {
  variant?: 'default' | 'inline' | 'stacked';
  responseActions?: Array<{
    id: string;
    label: string;
    variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  }>;
  onResponseAction?: (actionId: string) => void;
  onNavigate?: (href: string, citation: SerializableCitation) => void;
}

/**
 * Extract domain from URL
 */
function getDomainFromUrl(url: string): string {
  try {
    // Handle URLs that might not have protocol
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`;
    const urlObj = new URL(urlWithProtocol);
    return urlObj.hostname.replace('www.', '');
  } catch {
    // Fallback: try to extract domain manually
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : url;
  }
}

/**
 * Get favicon URL from domain
 */
function getFaviconUrl(domain?: string, url?: string): string {
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }
  if (url) {
    const domain = getDomainFromUrl(url);
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }
  return '';
}

/**
 * Default Citation Card Variant
 */
function CitationDefault({ 
  id, 
  href, 
  title, 
  snippet, 
  domain, 
  favicon, 
  type,
  onNavigate 
}: CitationProps) {
  const displayDomain = domain || getDomainFromUrl(href);
  const faviconUrl = favicon || getFaviconUrl(displayDomain, href);

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(href, { id, href, title, snippet, domain, favicon, type });
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="group relative flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
      data-citation-id={id}
    >
      <div className="flex items-start gap-3">
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt={displayDomain}
            className="mt-0.5 h-5 w-5 shrink-0 rounded"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
              {title}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleClick}
              aria-label={`Open ${title} in new tab`}
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          {snippet && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {snippet}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{displayDomain}</span>
            {type && (
              <>
                <span>•</span>
                <span className="capitalize">{type}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline Citation Chip Variant
 */
function CitationInline({ 
  id, 
  href, 
  title, 
  domain, 
  favicon,
  onNavigate 
}: CitationProps) {
  const displayDomain = domain || getDomainFromUrl(href);
  const faviconUrl = favicon || getFaviconUrl(displayDomain, href);

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(href, { id, href, title, domain, favicon });
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1.5 rounded-full px-2.5 text-xs"
          onClick={handleClick}
          data-citation-id={id}
        >
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt={displayDomain}
              className="h-3.5 w-3.5 rounded"
              loading="lazy"
            />
          )}
          <span className="truncate max-w-[120px]">{title}</span>
          <ExternalLinkIcon className="h-3 w-3 shrink-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{displayDomain}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Stacked Citation Variant (with popover)
 */
function CitationStacked({ 
  id, 
  href, 
  title, 
  snippet, 
  domain, 
  favicon, 
  type,
  onNavigate 
}: CitationProps) {
  const displayDomain = domain || getDomainFromUrl(href);
  const faviconUrl = favicon || getFaviconUrl(displayDomain, href);
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(href, { id, href, title, snippet, domain, favicon, type });
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label={`Citation: ${title}`}
          data-citation-id={id}
        >
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt={displayDomain}
              className="h-5 w-5 rounded"
              loading="lazy"
            />
          ) : (
            <div className="h-5 w-5 rounded bg-muted" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt={displayDomain}
                className="mt-0.5 h-5 w-5 shrink-0 rounded"
                loading="lazy"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold leading-tight text-foreground">
                {title}
              </h4>
              {snippet && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {snippet}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{displayDomain}</span>
                {type && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{type}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleClick}
          >
            <span>Visit source</span>
            <ExternalLinkIcon className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Citation Component
 * Display source references with attribution
 */
export function Citation({
  variant = 'default',
  ...props
}: CitationProps) {
  switch (variant) {
    case 'inline':
      return <CitationInline {...props} />;
    case 'stacked':
      return <CitationStacked {...props} />;
    case 'default':
    default:
      return <CitationDefault {...props} />;
  }
}

/**
 * Citation List Component
 * Display multiple citations in a grid
 */
export function CitationList({ 
  citations, 
  variant = 'default',
  onNavigate 
}: { 
  citations: SerializableCitation[];
  variant?: 'default' | 'inline' | 'stacked';
  onNavigate?: (href: string, citation: SerializableCitation) => void;
}) {
  if (citations.length === 0) {
    return null;
  }

  if (variant === 'stacked') {
    return (
      <div className="flex flex-wrap gap-2">
        {citations.map((citation) => (
          <Citation
            key={citation.id}
            variant="stacked"
            {...citation}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap gap-2">
        {citations.map((citation) => (
          <Citation
            key={citation.id}
            variant="inline"
            {...citation}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {citations.map((citation) => (
        <Citation
          key={citation.id}
          variant="default"
          {...citation}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
