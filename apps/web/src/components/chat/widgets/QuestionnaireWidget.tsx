/**
 * Questionnaire Widget
 * Displays questions one at a time with interactive UI
 * Shows a visible widget in the chat with Next button navigation
 */

import React, { useState, useMemo } from 'react';
import { useThreadRuntime } from '@assistant-ui/react';
import type { ToolCallData } from '../../../lib/tool-ui-registry';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../app/components/ui/card';
import { Button } from '../../../app/components/ui/button';
import { Input } from '../../../app/components/ui/input';
import { Label } from '../../../app/components/ui/label';
import { Textarea } from '../../../app/components/ui/textarea';
import { Badge } from '../../../app/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ToolResultContent {
  type: string;
  text: string | object;
}

interface Question {
  id: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea';
  label: string;
  required?: boolean;
  options?: string[]; // For select/multiselect
  placeholder?: string;
  min?: number; // For number type
  max?: number; // For number type
}

interface QuestionnaireSchema {
  title?: string;
  description?: string;
  questions: Question[];
}

interface QuestionnaireWidgetProps {
  toolCall: ToolCallData;
}

export function QuestionnaireWidget({ toolCall }: QuestionnaireWidgetProps) {
  const threadRuntime = useThreadRuntime();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Parse questionnaire schema from tool result
  const questionnaire: QuestionnaireSchema | null = useMemo(() => {
    const resultData = toolCall.result;
    console.log('[QuestionnaireWidget] Tool call:', {
      toolName: toolCall.toolName,
      state: toolCall.state,
      result: resultData,
      args: toolCall.args
    });
    
    if (!resultData) {
      console.log('[QuestionnaireWidget] No result data');
      return null;
    }

    try {
      let data: any = resultData;

      // Handle different result formats
      if (Array.isArray(resultData)) {
        const textPart = (resultData as ToolResultContent[]).find(
          (item) => item.type === 'text'
        );
        if (!textPart?.text) return null;
        data = typeof textPart.text === 'string' 
          ? JSON.parse(textPart.text) 
          : textPart.text;
      } else if (typeof resultData === 'string') {
        data = JSON.parse(resultData);
      }

      // Handle nested structure
      if (data.questionnaire) {
        data = data.questionnaire;
      }

      // Defensive parsing: Handle questions as string
      if (data.questions && typeof data.questions === 'string') {
        try {
          data.questions = JSON.parse(data.questions);
          console.log('[QuestionnaireWidget] Successfully parsed questions from string');
        } catch (e) {
          console.warn('[QuestionnaireWidget] Failed to parse questions string:', e);
        }
      }

      // Error recovery: If result has error but we have args, try to recover
      if (data.error && toolCall.args?.questions) {
        const argsQuestions = toolCall.args.questions;
        if (typeof argsQuestions === 'string') {
          try {
            data.questions = JSON.parse(argsQuestions);
            delete data.error; // Clear error if we recovered
            console.log('[QuestionnaireWidget] Recovered questions from args (string)');
          } catch (e) {
            console.warn('[QuestionnaireWidget] Failed to parse questions from args string:', e);
          }
        } else if (Array.isArray(argsQuestions)) {
          data.questions = argsQuestions;
          delete data.error;
          console.log('[QuestionnaireWidget] Recovered questions from args (array)');
        }
      }

      // Validate structure - only questions array is required, title is optional
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data as QuestionnaireSchema;
      }

      // Log detailed error for debugging
      console.error('[QuestionnaireWidget] Invalid questionnaire structure:', {
        hasTitle: !!data.title,
        hasQuestions: !!data.questions,
        questionsIsArray: Array.isArray(data.questions),
        questionsLength: Array.isArray(data.questions) ? data.questions.length : 'N/A',
        dataKeys: Object.keys(data),
        fullData: data
      });
      return null;
    } catch (error) {
      console.error('[QuestionnaireWidget] Failed to parse questionnaire:', error, resultData);
      return null;
    }
  }, [toolCall.result]);

  // Get current question
  const currentQuestion = questionnaire?.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= (questionnaire?.questions.length || 0) - 1;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Handle answer selection/input
  const handleAnswer = (value: any, shouldAutoAdvance: boolean = false) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));

    // Auto-advance to next question if enabled and not last question
    if (shouldAutoAdvance && !isLastQuestion) {
      // Small delay to show the selection before advancing
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300);
    }
  };

  // Handle next/submit button
  const handleNext = () => {
    if (!currentQuestion || !questionnaire) return;

    // Check if required question is answered
    if (currentQuestion.required && (currentAnswer === undefined || currentAnswer === null || currentAnswer === '')) {
      return; // Don't proceed if required question is not answered
    }

    if (isLastQuestion) {
      submitAnswers();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // Submit all collected answers
  const submitAnswers = async () => {
    if (!questionnaire) return;
    
    setIsSubmitting(true);

    // Format answers for submission
    const formattedAnswers: Record<string, any> = {};
    questionnaire.questions.forEach((q) => {
      const answer = answers[q.id];
      if (answer !== undefined && answer !== null && answer !== '') {
        formattedAnswers[q.id] = answer;
      }
    });

    // Create submission message
    const submissionText = `Based on my preferences:\n\n` +
      questionnaire.questions
        .map((q) => {
          const answer = formattedAnswers[q.id];
          if (answer === undefined) return null;
          
          if (Array.isArray(answer)) {
            return `${q.label}: ${answer.join(', ')}`;
          }
          return `${q.label}: ${answer}`;
        })
        .filter(Boolean)
        .join('\n') + '\n\nPlease help me find products based on these preferences.';

    // Send as user message
    threadRuntime.append({
      role: 'user',
      content: [{ type: 'text', text: submissionText }],
    });

    setSubmitted(true);
    setIsSubmitting(false);
  };

  // Render question input based on type
  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'select':
        return (
          <div className="space-y-2">
            {currentQuestion.options?.map((option) => {
              const isSelected = currentAnswer === option;
              return (
                <Button
                  key={option}
                  variant={isSelected ? 'default' : 'outline'}
                  className="w-full justify-start rounded-full"
                  onClick={() => handleAnswer(option, true)}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        );

      case 'multiselect':
        const selectedOptions = Array.isArray(currentAnswer) ? currentAnswer : [];
        return (
          <div className="space-y-2">
            {currentQuestion.options?.map((option) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <Button
                  key={option}
                  variant={isSelected ? 'default' : 'outline'}
                  className="w-full justify-start rounded-full"
                  onClick={() => {
                    const newSelection = isSelected
                      ? selectedOptions.filter(o => o !== option)
                      : [...selectedOptions, option];
                    handleAnswer(newSelection);
                  }}
                >
                  {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {option}
                </Button>
              );
            })}
          </div>
        );

      case 'boolean':
        return (
          <div className="flex gap-3">
            <Button
              variant={currentAnswer === true ? 'default' : 'outline'}
              className="flex-1 rounded-full"
              onClick={() => handleAnswer(true, true)}
            >
              Yes
            </Button>
            <Button
              variant={currentAnswer === false ? 'default' : 'outline'}
              className="flex-1 rounded-full"
              onClick={() => handleAnswer(false, true)}
            >
              No
            </Button>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={currentQuestion.placeholder || 'Enter a number'}
            value={currentAnswer || ''}
            onChange={(e) => handleAnswer(parseFloat(e.target.value) || '')}
            min={currentQuestion.min}
            max={currentQuestion.max}
            className="rounded-full"
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={currentQuestion.placeholder || 'Enter your answer'}
            value={currentAnswer || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            rows={4}
            className="rounded-lg"
          />
        );

      case 'text':
      default:
        return (
          <Input
            type="text"
            placeholder={currentQuestion.placeholder || 'Enter your answer'}
            value={currentAnswer || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            className="rounded-full"
          />
        );
    }
  };

  // Show loading state
  if (toolCall.state === 'running') {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading questionnaire...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (toolCall.state === 'error' || !questionnaire) {
    // Check if result contains an error message
    const errorMessage = toolCall.result?.error || toolCall.error || 'Failed to load questionnaire';
    
    return (
      <Card className="w-full max-w-2xl border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            {errorMessage}
          </p>
          {toolCall.result && (
            <p className="text-xs text-muted-foreground mt-2">
              The AI may not have provided the questionnaire in the correct format. Please try asking again.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Hide widget after submission
  if (submitted) {
    return null;
  }

  // Render questionnaire
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-4">
        {(questionnaire.title || questionnaire.description) && (
          <div>
            {questionnaire.title && (
              <CardTitle className="text-xl">{questionnaire.title}</CardTitle>
            )}
            {questionnaire.description && (
              <CardDescription className={questionnaire.title ? "mt-2" : ""}>{questionnaire.description}</CardDescription>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1 w-full max-w-fit">
            {questionnaire.questions.map((_, index) => {
              const question = questionnaire.questions[index];
              const isCurrent = index === currentQuestionIndex;
              const isAnswered = answers[question.id] !== undefined && answers[question.id] !== null && answers[question.id] !== '';
              
              return (
                <button
                  key={index}
                  className={`rounded-full h-8 w-8 p-0 text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isAnswered
                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                  onClick={() => setCurrentQuestionIndex(index)}
                  aria-label={`Go to question ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          {currentQuestion?.required && (
            <Badge variant="secondary" className="rounded-full">Required</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {currentQuestion && (
          <div className="space-y-6">
            <Label className="text-base font-semibold leading-6">
              {currentQuestion.label}
              {currentQuestion.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            {renderQuestionInput()}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between gap-3 pt-6">
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>
        <Button
          onClick={handleNext}
          className="rounded-full"
          disabled={
            isSubmitting ||
            (currentQuestion?.required && (currentAnswer === undefined || currentAnswer === null || currentAnswer === ''))
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : isLastQuestion ? (
            <>
              Submit
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
