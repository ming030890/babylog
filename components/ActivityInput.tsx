import React, { useState, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';

interface ActivityInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<boolean>;
  isProcessing: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  mode: 'add' | 'edit';
  existingSummary?: string;
  suggestions?: string[];
}

export const ActivityInput: React.FC<ActivityInputProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isProcessing,
  errorMessage,
  onClearError,
  mode,
  existingSummary,
  suggestions = []
}) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setText('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const success = await onSubmit(text);
    if (success) {
      setText('');
      onClose();
    }
  };

  const addSuggestion = (suggestion: string) => {
    // If input is empty, just set it. 
    // If input has text, append with a space.
    if (!text) {
      setText(suggestion);
    } else {
      setText(prev => `${prev} ${suggestion}`);
    }
    if (errorMessage) {
      onClearError();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-950 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pointer-events-auto transform transition-transform animate-in slide-in-from-bottom-4 mb-0 sm:mb-8 mx-0 sm:mx-4 flex flex-col gap-5 z-50 border border-transparent dark:border-slate-800">
        
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {mode === 'edit' ? 'Update Log' : 'New Log'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {mode === 'edit' && existingSummary && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Current entry:</span> {existingSummary}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMessage) {
                onClearError();
              }
            }}
            placeholder={
              mode === 'edit'
                ? "Describe the update... e.g. 'change to 16:30' or 'make it 180ml'"
                : "Type anything... e.g. '15:00 230ml' or '15:30 150 and 16:30 steroid cream'"
            }
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-0 ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            rows={3}
            disabled={isProcessing}
          />
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <span className="font-semibold">Couldn’t parse that.</span>
              <span>{errorMessage}</span>
            </div>
          )}
          
          {mode === 'add' && suggestions.length > 0 && (
            <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Quick Add</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
               {suggestions.map((s) => (
                 <button
                   key={s}
                   type="button"
                   onClick={() => addSuggestion(s)}
                   className="flex-shrink-0 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:bg-emerald-100 dark:active:bg-emerald-500/20 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/60"
                 >
                   {s}
                 </button>
               ))}
            </div>
          </div>
          )}

          <button
            type="submit"
            disabled={!text.trim() || isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 dark:bg-slate-100 dark:hover:bg-white dark:disabled:bg-slate-700 text-white dark:text-slate-900 px-6 py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-slate-200 dark:shadow-slate-900/40"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {mode === 'edit' ? 'Update Entry' : 'Save Entry'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
