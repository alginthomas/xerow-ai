import type { ComposerSuggestion } from '../../../lib/composer-suggestions-context';
import { cn } from '../ui/utils';

interface ComposerSuggestionsProps {
  suggestions: ComposerSuggestion[];
}

export function ComposerSuggestions({ suggestions }: ComposerSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="px-1 pb-2">
      <div className="border-t border-border/50 pt-2 flex flex-row flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.text}-${index}`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              suggestion.onSelect();
            }}
            className={cn(
              "group inline-flex items-center max-w-full px-5 py-2.5 text-sm rounded-3xl border border-border/50 bg-background/50",
              "hover:bg-accent/80 hover:border-border transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label={suggestion.text}
          >
            <span className="font-medium whitespace-normal break-words">
              {suggestion.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
