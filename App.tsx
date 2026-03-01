import React, { useState } from 'react';
import CallList from './components/CallList';
import CallDetail from './components/CallDetail';

const App: React.FC = () => {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState<string>('');

  const handleBack = () => {
    setSelectedCallId(null);
  };

  const handleSearchCaller = (caller: string) => {
    setListSearch(caller);
    setSelectedCallId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold tracking-tight cursor-pointer"
              onClick={() => { setSelectedCallId(null); setListSearch(''); }}
            >
              Tamlelan
            </h1>
            <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-medium">
              ניהול שיחות
            </span>
          </div>
          {selectedCallId && (
            <button
              onClick={handleBack}
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              ← רשימת שיחות
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {selectedCallId ? (
          <CallDetail
            callId={selectedCallId}
            onBack={handleBack}
            onSearchCaller={handleSearchCaller}
          />
        ) : (
          <CallList
            onSelectCall={setSelectedCallId}
            initialSearch={listSearch}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400">
        Tamlelan • Voicenter Integration
      </footer>
    </div>
  );
};

export default App;
