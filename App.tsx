import React, { useState } from 'react';
import CallList from './components/CallList';
import CallDetail from './components/CallDetail';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { signOutUser } from './lib/firebase';
import { setAuthToken } from './services/api';

const App: React.FC = () => {
  const { authUser, loading, error } = useAuth();
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState<string>('');
  const [aiHighlight, setAiHighlight] = useState<string | null>(null);

  // Keep module-level auth token in sync (synchronous so child effects see it immediately)
  setAuthToken(authUser?.token ?? null);

  // ── Loading screen ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <svg className="animate-spin h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-300">טוען...</span>
        </div>
      </div>
    );
  }

  // ── Login screen ────────────────────────────────────────────
  if (!authUser) {
    return <LoginScreen error={error} />;
  }

  // ── Handlers ────────────────────────────────────────────────
  const handleBack = () => {
    setSelectedCallId(null);
    setAiHighlight(null);
  };

  const handleSearchCaller = (caller: string) => {
    setListSearch(caller);
    setSelectedCallId(null);
    setAiHighlight(null);
  };

  const handleSelectCall = (id: string, highlight?: string) => {
    setSelectedCallId(id);
    setAiHighlight(highlight || null);
  };

  // ── Main app ────────────────────────────────────────────────
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

          <div className="flex items-center gap-3">
            {selectedCallId && (
              <button
                onClick={handleBack}
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                ← רשימת שיחות
              </button>
            )}

            {/* User info + sign-out */}
            <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
              {authUser.user.photoURL ? (
                <img
                  src={authUser.user.photoURL}
                  alt="avatar"
                  className="w-7 h-7 rounded-full ring-2 ring-cyan-500/40"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold">
                  {authUser.email[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs text-slate-400 hidden sm:block max-w-[130px] truncate">
                {authUser.email}
              </span>
              <button
                onClick={() => signOutUser()}
                className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                title="יציאה"
              >
                יציאה
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {selectedCallId ? (
          <CallDetail
            callId={selectedCallId}
            onBack={handleBack}
            onSearchCaller={handleSearchCaller}
            aiHighlight={aiHighlight}
          />
        ) : (
          <CallList
            onSelectCall={handleSelectCall}
            initialSearch={listSearch}
            authToken={authUser.token}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400">
        Tamlelan • {authUser.email}
      </footer>
    </div>
  );
};

export default App;
