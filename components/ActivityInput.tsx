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
}

const SUGGESTIONS = [
  'steroid cream',
  '180ml', 
  '210ml', 
  'poo', 
  'bath',
  'sleep',
  'wake up'
];

export const ActivityInput: React.FC<ActivityInputProps> = ({ isOpen, onClose, onSubmit, isProcessing, errorMessage, onClearError, mode, existingSummary }) => {
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
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pointer-events-auto transform transition-transform animate-in slide-in-from-bottom-4 mb-0 sm:mb-8 mx-0 sm:mx-4 flex flex-col gap-5 z-50">
        
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">
            {mode === 'edit' ? 'Update Log' : 'New Log'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {mode === 'edit' && existingSummary && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Current entry:</span> {existingSummary}
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
            className="w-full p-4 bg-slate-50 rounded-2xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-xl placeholder:text-slate-400"
            rows={3}
            disabled={isProcessing}
          />
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Couldn’t parse that.</span>
              <span>{errorMessage}</span>
            </div>
          )}
          
          {mode === 'add' && (
            <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Quick Add</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
               {SUGGESTIONS.map((s) => (
                 <button
                   key={s}
                   type="button"
                   onClick={() => addSuggestion(s)}
                   className="flex-shrink-0 bg-slate-100 hover:bg-indigo-50 active:bg-indigo-100 text-slate-700 hover:text-indigo-700 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors border border-transparent hover:border-indigo-200"
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
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-6 py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-slate-200"
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
