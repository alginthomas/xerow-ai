import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useComposerRuntime } from '@assistant-ui/react';

export interface ComposerMultiSelectOption {
  text: string;
}

export interface ComposerMultiSelectConfig {
  options: ComposerMultiSelectOption[];
  onSubmit: (selectedTexts: string[]) => void;
  submitButtonText?: string; // Default: "Submit"
}

interface ComposerMultiSelectContextType {
  config: ComposerMultiSelectConfig | null;
  setConfig: (config: ComposerMultiSelectConfig | null) => void;
  selectedIndices: Set<number>;
  setSelectedIndices: (indices: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
}

const ComposerMultiSelectContext = createContext<ComposerMultiSelectContextType | undefined>(undefined);

export function ComposerMultiSelectProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ComposerMultiSelectConfig | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const composer = useComposerRuntime();

  // Clear multi-select when user starts typing
  useEffect(() => {
    const unsubscribe = composer.subscribe(() => {
      const state = composer.getState();
      const inputValue = state.text;

      if (inputValue && inputValue.trim().length > 0) {
        setConfig(null);
        setSelectedIndices(new Set());
      }
    });

    return unsubscribe;
  }, [composer]);

  return (
    <ComposerMultiSelectContext.Provider value={{ config, setConfig, selectedIndices, setSelectedIndices }}>
      {children}
    </ComposerMultiSelectContext.Provider>
  );
}

export function useComposerMultiSelect() {
  const context = useContext(ComposerMultiSelectContext);
  if (!context) {
    throw new Error('useComposerMultiSelect must be used within ComposerMultiSelectProvider');
  }
  return context;
}
