import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { useComposerRuntime } from '@assistant-ui/react';

export interface ComposerSuggestion {
  text: string;
  onSelect: () => void;
}

interface ComposerSuggestionsContextType {
  suggestions: ComposerSuggestion[];
  setSuggestions: (suggestions: ComposerSuggestion[]) => void;
}

const ComposerSuggestionsContext = createContext<ComposerSuggestionsContextType | undefined>(undefined);

export function ComposerSuggestionsProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<ComposerSuggestion[]>([]);
  const previousTextRef = useRef<string>('');
  const composer = useComposerRuntime();

  // Standard chat behavior: hide suggestions when typing, clear when message is sent
  useEffect(() => {
    const unsubscribe = composer.subscribe(() => {
      const state = composer.getState();
      const currentText = state.text?.trim() || '';
      const previousText = previousTextRef.current;

      if (currentText.length > 0) {
        // User is typing - hide suggestions using functional update to avoid race conditions
        setSuggestions((prev) => (prev.length > 0 ? [] : prev));
      } else if (previousText.length > 0 && currentText.length === 0) {
        // Text went from non-empty to empty - message was likely sent
        // Clear suggestions permanently (don't restore)
        setSuggestions([]);
      }
      // If input is empty and was already empty, do nothing
      // Suggestions should only come from new assistant responses (via widgets)

      previousTextRef.current = currentText;
    });

    return unsubscribe;
  }, [composer]);

  return (
    <ComposerSuggestionsContext.Provider
      value={{
        suggestions,
        setSuggestions,
      }}
    >
      {children}
    </ComposerSuggestionsContext.Provider>
  );
}

export function useComposerSuggestions() {
  const context = useContext(ComposerSuggestionsContext);
  if (!context) {
    throw new Error('useComposerSuggestions must be used within ComposerSuggestionsProvider');
  }
  return context;
}
