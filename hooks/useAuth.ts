import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

// ── Access control ──────────────────────────────────────────
const ALLOWED_DOMAIN = '@drushim.il';
const ALLOWED_EMAILS = ['eyalbch@gmail.com'];

function isEmailAllowed(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith(ALLOWED_DOMAIN) || ALLOWED_EMAILS.includes(lower);
}

// ── Auth state ───────────────────────────────────────────────
export interface AuthUser {
  user: User;
  token: string;
  email: string;
}

export interface AuthState {
  authUser: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): AuthState {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh (every hour)
    const unsubscribe = auth.onIdTokenChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || '';

        if (!isEmailAllowed(email)) {
          // Immediately sign out unauthorized users
          await auth.signOut();
          setAuthUser(null);
          setError(`גישה נדחתה — רק כתובות ${ALLOWED_DOMAIN} יכולות להיכנס`);
          setLoading(false);
          return;
        }

        try {
          const token = await firebaseUser.getIdToken();
          setAuthUser({ user: firebaseUser, token, email });
          setError(null);
        } catch {
          setAuthUser(null);
          setError('שגיאה בקבלת טוקן — נסה שוב');
        }
      } else {
        setAuthUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { authUser, loading, error };
}
