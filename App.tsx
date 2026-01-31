import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Baby,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Trash2,
  Pencil,
  Moon,
  Sun,
  Utensils,
  Pill,
  Waves,
  Wind,
  Droplets,
  Circle,
  Clock,
  Milk
} from 'lucide-react';
import { AppState, ActivityLog, SheetConfig, ParsedActivity } from './types';
import { initGoogleServices, fetchActivities, appendActivity, deleteActivity, updateActivity } from './services/sheetsService';
import { parseActivityText, parseActivityUpdate } from './services/geminiService';
import { ActivityInput } from './components/ActivityInput';

const SHEET_ID = import.meta.env.VITE_SHEET_ID?.trim();
const DAYS_PER_PAGE = 7;

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  if (isToday) return 'Today';
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};

// Helper to pick an icon based on event type text
const getEventIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('sleep') || t.includes('nap') || t.includes('bed')) return <Moon className="w-5 h-5 text-slate-500 dark:text-slate-300" />;
  if (t.includes('wake') || t.includes('up')) return <Sun className="w-5 h-5 text-amber-500 dark:text-amber-300" />;
  if (t.includes('feed') || t.includes('bottle') || t.includes('milk') || t.includes('eat') || t.includes('nursing')) return <Utensils className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
  if (t.includes('med') || t.includes('vit') || t.includes('cream') || t.includes('drop')) return <Pill className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
  if (t.includes('bath') || t.includes('wash')) return <Waves className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;
  if (t.includes('poo') || t.includes('diaper') || t.includes('nappy')) return <Wind className="w-5 h-5 text-slate-500 dark:text-slate-300" />;
  if (t.includes('pee') || t.includes('wet')) return <Droplets className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
  return <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500" />;
};

const calculateDailyMilk = (items: ActivityLog[]) => {
  let total = 0;
  items.forEach(item => {
    const t = item.eventType.toLowerCase();
    if (t.includes('feed') || t.includes('feed_ml') || t.includes('bottle') || t.includes('milk') || t.includes('formula')) {
      // Try to extract a number from the value string (e.g. "180ml" -> 180)
      const match = item.value.match(/(\d+)/);
      if (match) {
        total += parseInt(match[1], 10);
      }
    }
  });
  return total;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);
  // Lazy Loading State
  const [visibleDaysCount, setVisibleDaysCount] = useState(DAYS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SHEET_ID) {
      setAppState(AppState.ERROR);
      setErrorMsg('Missing VITE_SHEET_ID. Add it to your .env.local file and restart the app.');
      return;
    }

    const initialConfig: SheetConfig = { spreadsheetId: SHEET_ID };
    setConfig(initialConfig);
    setAppState(AppState.LOADING);
    initializeServices(initialConfig);
  }, []);

  const initializeServices = async (cfg: SheetConfig) => {
    try {
      await initGoogleServices(cfg, () => {
        loadLogs(cfg.spreadsheetId);
      });
    } catch (err: any) {
      setAppState(AppState.ERROR);
      setErrorMsg(err.message || "Failed to initialize Google Services.");
    }
  };

  const loadLogs = async (spreadsheetId: string) => {
    setAppState(AppState.LOADING);
    try {
      const fetchedLogs = await fetchActivities(spreadsheetId);
      setLogs(fetchedLogs);
      setAppState(AppState.READY);
      setErrorMsg(null);
    } catch (err: any) {
      setAppState(AppState.ERROR);
      setErrorMsg(err.message || "Failed to load logs. Ensure the Sheet is shared with the service account.");
    }
  };

  const handleLogSubmit = async (text: string): Promise<boolean> => {
    if (!config) return false;
    setIsProcessing(true);
    setInputError(null);
    try {
      const knownTypes = Array.from(new Set(logs.map(l => l.eventType))) as string[];
      const parsed = await parseActivityText(text, knownTypes);
      const nextLogs: ActivityLog[] = [];

      for (const entry of parsed.activities) {
        const newLog: ActivityLog = {
          timestamp: entry.timestamp,
          eventType: entry.event_type,
          value: entry.value,
          originalInput: text
        };
        const id = await appendActivity(config.spreadsheetId, newLog);
        if (typeof id === 'string') {
          newLog.id = id;
        }
        nextLogs.push(newLog);
      }

      setLogs(prev => {
        const updated = [...nextLogs, ...prev];
        return updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });

      return true;
    } catch (err: any) {
      console.error(err);
      setInputError(err.message || "Failed to log activity.");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogUpdate = async (instruction: string): Promise<boolean> => {
    if (!config || !editingLog || !editingLog.id) return false;
    setIsProcessing(true);
    setInputError(null);
    try {
      const knownTypes = Array.from(new Set(logs.map(l => l.eventType))) as string[];
      const existing: ParsedActivity = {
        timestamp: editingLog.timestamp,
        event_type: editingLog.eventType,
        value: editingLog.value
      };
      const updated = await parseActivityUpdate(instruction, existing, knownTypes);
      const updatedLog: ActivityLog = {
        timestamp: updated.timestamp,
        eventType: updated.event_type,
        value: updated.value,
        originalInput: editingLog.originalInput,
        id: editingLog.id
      };
      await updateActivity(config.spreadsheetId, editingLog.id, updatedLog);
      const updatedLogs = await fetchActivities(config.spreadsheetId);
      setLogs(updatedLogs);
      setEditingLog(null);
      return true;
    } catch (err: any) {
      console.error(err);
      setInputError(err.message || "Failed to update activity.");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (log: ActivityLog) => {
    if (!config || !log.id) return;
    const confirmed = window.confirm(`Delete "${log.eventType}" at ${formatTime(log.timestamp)}?`);
    if (!confirmed) return;
    setDeletingRow(log.id);
    try {
      await deleteActivity(config.spreadsheetId, log.id);
      const updatedLogs = await fetchActivities(config.spreadsheetId);
      setLogs(updatedLogs);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || "Failed to delete activity"}`);
    } finally {
      setDeletingRow(null);
    }
  };

  const groupedLogs = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    logs.forEach(log => {
      const dateKey = new Date(log.timestamp).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return Object.entries(groups).map(([dateStr, items]) => ({
      dateLabel: formatDate(items[0].timestamp),
      isoDate: items[0].timestamp,
      items,
      dailyMilkTotal: calculateDailyMilk(items)
    }));
  }, [logs]);

  // Lazy Loading Effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && appState === AppState.READY) {
          setVisibleDaysCount(prev => Math.min(prev + DAYS_PER_PAGE, groupedLogs.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [groupedLogs.length, appState]);

  const renderError = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);
    const isUrl = (value: string) => /https?:\/\/[^\s]+/.test(value);

    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Connection Issue</h2>
        <div className="text-slate-600 dark:text-slate-300 mb-6 max-w-md break-words">
          {parts.map((part, i) => 
            isUrl(part) ? (
              <a 
                key={i} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sky-600 dark:text-sky-400 underline inline-flex items-center gap-1 hover:text-sky-800 dark:hover:text-sky-300"
              >
                Enable API <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => config && loadLogs(config.spreadsheetId)}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200/60 dark:shadow-emerald-900/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (appState === AppState.SETUP) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
          <Baby className="w-16 h-16 text-sky-300 dark:text-sky-400 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Initializing</h2>
          <p className="text-slate-500 dark:text-slate-400">Checking your connection...</p>
        </div>
      );
    }

    if (appState === AppState.ERROR) {
      return renderError(errorMsg || "An unknown error occurred.");
    }

    if (appState === AppState.LOADING) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <RefreshCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading your logs...</p>
        </div>
      );
    }

    if (logs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 opacity-60">
           <Baby className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
           <p className="text-slate-600 dark:text-slate-300 font-medium">No activities logged yet.</p>
           <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Tap the + button to start tracking.</p>
        </div>
      );
    }

    const visibleGroups = groupedLogs.slice(0, visibleDaysCount);

    return (
      <div className="pb-28">
        {visibleGroups.map((group) => (
          <div key={group.dateLabel} className="mb-8">
            <div className="sticky top-[73px] z-10 bg-slate-50/95 dark:bg-slate-900/80 backdrop-blur-sm py-2 border-b border-slate-100 dark:border-slate-800 mb-4 flex justify-between items-center pr-2">
              <h3 className="px-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {group.dateLabel}
              </h3>
              {group.dailyMilkTotal > 0 && (
                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-full border border-rose-100 dark:border-rose-900/60">
                  <Milk className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-300">{group.dailyMilkTotal}ml</span>
                </div>
              )}
            </div>
            
            <div className="relative pl-6 ml-2 border-l-2 border-slate-200 dark:border-slate-800 space-y-8">
              {group.items.map((log, idx) => (
                <div key={idx} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] top-0 bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm z-0">
                     {getEventIcon(log.eventType)}
                  </div>
                  
                  {/* Content Card */}
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {formatTime(log.timestamp)}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-none">
                        {log.eventType}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLog(log);
                            setIsInputOpen(true);
                          }}
                          disabled={!log.id}
                          className="p-1.5 rounded-full text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Edit entry"
                          aria-label="Edit entry"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(log)}
                          disabled={!log.id || deletingRow === log.id}
                          className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Delete entry"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {log.value && (
                      <div className="text-slate-600 dark:text-slate-300 text-base leading-snug bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm w-full max-w-sm">
                        {log.value}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Intersection Observer Target for Infinite Scroll */}
        {visibleDaysCount < groupedLogs.length && (
           <div ref={observerTarget} className="h-10 flex items-center justify-center w-full">
              <RefreshCw className="w-6 h-6 text-slate-300 dark:text-slate-600 animate-spin" />
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 selection:bg-emerald-100 dark:selection:bg-emerald-900/40 selection:text-emerald-900 dark:selection:text-emerald-100">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200/70 dark:shadow-emerald-900/40">
            <Baby className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            BabyLog
          </h1>
        </div>
        {(appState === AppState.READY || appState === AppState.ERROR) && (
          <button 
            onClick={() => config && loadLogs(config.spreadsheetId)}
            className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {renderContent()}
      </main>

      {appState === AppState.READY && (
        <button
          onClick={() => {
            setEditingLog(null);
            setIsInputOpen(true);
          }}
          className="fixed bottom-8 right-6 w-14 h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl shadow-xl shadow-slate-400/40 dark:shadow-slate-900/60 flex items-center justify-center transition-all hover:scale-105 active:scale-90 active:bg-black dark:active:bg-white z-30"
          aria-label="Add Log"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      <ActivityInput 
        isOpen={isInputOpen} 
        onClose={() => {
          setIsInputOpen(false);
          setInputError(null);
          setEditingLog(null);
        }} 
        onSubmit={editingLog ? handleLogUpdate : handleLogSubmit}
        isProcessing={isProcessing}
        errorMessage={inputError}
        onClearError={() => setInputError(null)}
        mode={editingLog ? 'edit' : 'add'}
        existingSummary={
          editingLog
            ? `${formatTime(editingLog.timestamp)} · ${editingLog.eventType}${editingLog.value ? ` · ${editingLog.value}` : ''}`
            : undefined
        }
      />
    </div>
  );
};

export default App;
