import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './Card';

export function AuthCard() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { first_name: firstName.trim(), last_name: lastName.trim() }
          }
        });
        if (error) throw error;
        if (!data.session) setMessage('Check your email to confirm your account, then log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally { setBusy(false); }
  }

  return <Card title={signup ? 'Create an account' : 'Log in'} subtitle="Save your public calendars and access them next time.">
    <form className="grid grid-cols-1 gap-3" onSubmit={submit}>
      {signup && <>
        <label className="field grid grid-cols-1 gap-2"><span>First name (optional)</span><input type="text" autoComplete="given-name" value={firstName} disabled={busy} onChange={e => setFirstName(e.target.value)} /></label>
        <label className="field grid grid-cols-1 gap-2"><span>Last name (optional)</span><input type="text" autoComplete="family-name" value={lastName} disabled={busy} onChange={e => setLastName(e.target.value)} /></label>
      </>}
      <label className="field grid grid-cols-1 gap-2"><span>Email</span><input type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></label>
      <label className="field grid grid-cols-1 gap-2"><span>Password</span><input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 6 : undefined} required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Please wait...' : signup ? 'Sign up' : 'Log in'}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { setSignup(!signup); setMessage(''); setPassword(''); }}>{signup ? 'Already have an account? Log in' : 'Create an account'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </Card>;
}
