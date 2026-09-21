import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import App from '../App';
import { AuthCard } from './AuthCard';

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    // INITIAL_SESSION restores local storage; later events include sign-out in other tabs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    if (!supabase) return;
    setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to log out. Please try again.');
    }
  }

  // A new user gets a new App instance: previous calendars and pending UI results are discarded.
  if (ready && session) return <App key={session.user.id} userId={session.user.id} email={session.user.email ?? ''}
    firstName={typeof session.user.user_metadata.first_name === 'string' ? session.user.user_metadata.first_name : ''}
    lastName={typeof session.user.user_metadata.last_name === 'string' ? session.user.user_metadata.last_name : ''}
    onLogout={logout} logoutError={error} />;
  return <main className="mx-auto max-w-[1280px] px-5 pt-8 pb-16 [overflow-wrap:anywhere] [@media(max-width:640px)]:px-3.5">
    <header className="mb-6"><p className="eyebrow">Public calendar viewer</p><h1>Time Snaps</h1></header>
    {!supabase ? <p role="alert">Account connection is not configured yet. Please try again after setup is complete.</p> : !ready ? <p role="status">Restoring your session...</p> : <AuthCard />}
  </main>;
}
