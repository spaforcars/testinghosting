import React, { useEffect, useState } from 'react';
import Button from './Button';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import { hasSupabaseClientEnv } from '../lib/env';

interface AuthGateProps {
  title: string;
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ title, children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!hasSupabaseClientEnv) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
        <h2 className="font-display text-2xl font-semibold uppercase">Supabase Not Configured</h2>
        <p className="mt-3 text-sm leading-relaxed">
          Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable dashboard authentication.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-8 text-sm text-gray-600">
        Loading session...
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">Sign in to continue.</p>
        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm focus:border-brand-mclaren focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm focus:border-brand-mclaren focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" fullWidth>
            {submitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-gray-500 underline-offset-2 hover:text-brand-mclaren hover:underline"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
};

export default AuthGate;
