import React, { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';

interface Props {
  error?: string | null;
}

const LoginScreen: React.FC<Props> = ({ error }) => {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
      // onIdTokenChanged in useAuth handles the rest
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup — not an error
      } else {
        setLocalError('שגיאה בהתחברות. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        {/* Logo / Title */}
        <div className="mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-cyan-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Tamlelan</h1>
          <p className="text-slate-400 text-sm mt-1">מערכת ניתוח שיחות</p>
        </div>

        {/* Error message */}
        {displayError && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right" dir="rtl">
            {displayError}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {/* Google logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.17z" fill="#4285F4"/>
            <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.9v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
            <path d="M4.51 10.53a4.8 4.8 0 0 1 0-3.06V5.4H1.9a8 8 0 0 0 0 7.2l2.61-2.07z" fill="#FBBC05"/>
            <path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.9 5.4l2.61 2.07c.63-1.89 2.4-3.29 4.47-3.29z" fill="#EA4335"/>
          </svg>
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              מתחבר...
            </span>
          ) : 'כניסה עם Google'}
        </button>

        <p className="mt-5 text-xs text-slate-400" dir="rtl">
          גישה מוגבלת לכתובות <span className="font-medium text-slate-500">@drushim.il</span> בלבד
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
