import { useRef } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useComposerMultiSelect } from '../../../lib/composer-multi-select-context';

export function ComposerMultiSelect() {
  const { config, selectedIndices, setSelectedIndices } = useComposerMultiSelect();
  const isUpdatingRef = useRef(false);

  if (!config || config.options.length === 0) return null;

  const handleToggle = (index: number) => {
    if (isUpdatingRef.current) return;
    
    isUpdatingRef.current = true;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      // Create a completely new Set to ensure React detects the change
      return new Set(Array.from(next));
    });
    
    // Reset flag after state update
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    handleToggle(index);
  };

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedIndices.size > 0) {
      const selectedTexts = Array.from(selectedIndices)
        .sort((a, b) => a - b)
        .map(index => config.options[index].text);
      config.onSubmit(selectedTexts);
    }
  };

  const hasSelections = selectedIndices.size > 0;

  return (
    <div className="px-1 pb-2">
      <div className="border-t border-border/50 pt-2 flex flex-col gap-2">
        {config.options.map((option, index) => {
          const isSelected = selectedIndices.has(index);
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => handleButtonClick(e, index)}
              className={cn(
                "group w-fit max-w-full flex items-center gap-3 px-5 py-2.5 text-sm rounded-3xl border transition-all duration-150 cursor-pointer relative z-10",
                isSelected
                  ? "border-0 bg-primary/10 hover:bg-primary/20 text-foreground shadow-sm"
                  : "border-0 border-border/50 hover:border-border bg-card hover:bg-muted-foreground/15 text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              )}
              aria-label={`${isSelected ? "Deselect" : "Select"} ${option.text}`}
            >
              <Checkbox
                checked={isSelected}
                className="pointer-events-none flex-shrink-0"
              />
              <span className={cn(
                "font-medium block",
                "truncate group-hover:whitespace-normal group-hover:break-words"
              )}>
                {option.text}
              </span>
            </button>
          );
        })}
        
        {hasSelections && (
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              className="rounded-3xl px-5 py-2.5 text-sm"
              size="sm"
            >
              {config.submitButtonText || 'Submit'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
