import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AccountMenuProps {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  disabled: boolean;
  onLogout: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again.';
  return /bucket not found/i.test(message) ? 'Avatar uploads are not set up yet. Please finish the avatar storage setup in Supabase.' : message;
}

export function AccountMenu({ userId, email, firstName, lastName, disabled, onLogout }: AccountMenuProps) {
  const [draftFirstName, setDraftFirstName] = useState(firstName);
  const [draftLastName, setDraftLastName] = useState(lastName);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [nameError, setNameError] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const path = `${userId}/avatar`;
  const blocked = disabled || busy || loading;

  useEffect(() => {
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
  }, [firstName, lastName]);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || disabled || savingName) return;
    setSavingName(true);
    setNameMessage('');
    setNameError('');
    try {
      const nextFirstName = draftFirstName.trim();
      const nextLastName = draftLastName.trim();
      const { error } = await supabase.auth.updateUser({
        data: { first_name: nextFirstName, last_name: nextLastName }
      });
      if (error) throw error;
      if (!alive.current) return;
      setDraftFirstName(nextFirstName);
      setDraftLastName(nextLastName);
      setNameMessage('Name saved.');
    } catch (error) {
      if (alive.current) setNameError(`Could not save name. ${errorMessage(error)}`);
    } finally {
      if (alive.current) setSavingName(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      setLoading(true);
      setError('');
      try {
        const storage = supabase!.storage.from('avatars');
        const { data: files, error: listError } = await storage.list(userId, { search: 'avatar', limit: 10 });
        if (listError) throw listError;
        if (!files.some(file => file.name === 'avatar')) return;
        const { data, error: downloadError } = await storage.download(path);
        if (downloadError) throw downloadError;
        if (!cancelled) setAvatar(URL.createObjectURL(data));
      } catch (error) {
        if (!cancelled) setError(`Could not load avatar. ${errorMessage(error)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [userId, path, attempt]);

  useEffect(() => () => { if (avatar) URL.revokeObjectURL(avatar); }, [avatar]);

  async function upload(file: File) {
    if (blocked || pending.current) return;
    setError('');
    setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setError('Choose a non-empty image no larger than 2 MB.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      // Check that the file can actually be displayed before replacing the saved avatar.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const { error } = await supabase!.storage.from('avatars').upload(path, file, {
        upsert: true, contentType: file.type, cacheControl: '0'
      });
      if (error) throw error;
      if (!alive.current) return;
      setAvatar(URL.createObjectURL(file));
      setMessage('Avatar saved.');
    } catch (error) {
      if (alive.current) setError(`Could not save avatar. ${errorMessage(error)}`);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function remove() {
    if (blocked || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error } = await supabase!.storage.from('avatars').remove([path]);
      if (error) throw error;
      if (!alive.current) return;
      setAvatar(null);
      setMessage('Avatar removed.');
    } catch (error) {
      if (alive.current) setError(`Could not remove avatar. ${errorMessage(error)}`);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const initial = email.slice(0, 1).toUpperCase() || 'A';
  return <details className="relative shrink-0">
    <summary className="size-12 flex cursor-pointer list-none items-center justify-center overflow-hidden rounded-full bg-accent-soft text-sm font-medium text-ink [&::-webkit-details-marker]:hidden" aria-label="Account menu">
      {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initial}
    </summary>
    <div className="account-panel absolute right-0 lg:left-0 lg:right-auto top-[calc(100%+8px)] z-[2] max-h-[calc(100dvh-100px)] overflow-y-auto w-[min(280px,calc(100vw-40px))] p-[18px] text-ink">
      <p className="text-sm [overflow-wrap:anywhere]">{email}</p>
      <form className="mb-4 grid grid-cols-1 gap-3" onSubmit={saveName} aria-label="Profile name">
        <label className="field grid grid-cols-1 gap-2"><span>First name (optional)</span><input type="text" autoComplete="given-name" value={draftFirstName} disabled={disabled || savingName} onChange={event => { setDraftFirstName(event.target.value); setNameMessage(''); setNameError(''); }} /></label>
        <label className="field grid grid-cols-1 gap-2"><span>Last name (optional)</span><input type="text" autoComplete="family-name" value={draftLastName} disabled={disabled || savingName} onChange={event => { setDraftLastName(event.target.value); setNameMessage(''); setNameError(''); }} /></label>
        <button type="submit" className="secondary-button text-sm" disabled={disabled || savingName}>{savingName ? 'Saving name...' : 'Save name'}</button>
        {nameMessage && <p role="status" className="text-sm">{nameMessage}</p>}
        {nameError && <p role="alert" className="text-sm text-error">{nameError}</p>}
      </form>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-lg text-ink">
          {avatar ? <img src={avatar} alt="Your avatar" className="size-full object-cover" /> : <span aria-label="Default avatar">{initial}</span>}
        </div>
        <button type="button" className="secondary-button text-sm" disabled={blocked} onClick={() => input.current?.click()}>
          {busy ? 'Saving...' : avatar ? 'Change avatar' : 'Upload avatar'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload avatar" disabled={blocked} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void upload(file);
      }} />
      <p className="text-xs text-muted">JPEG, PNG, or WebP · up to 2 MB. Uploads save automatically.</p>
      {avatar && <button type="button" className="ghost-button mb-3 text-sm" disabled={blocked} onClick={() => void remove()}>Remove avatar</button>}
      {loading && <p role="status" className="text-sm">Loading avatar...</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <div role="alert" className="mb-3 text-sm text-error"><p>{error}</p><button type="button" className="ghost-button" disabled={blocked} onClick={() => setAttempt(value => value + 1)}>Retry loading avatar</button></div>}
      <button type="button" className="secondary-button flex items-center gap-2" disabled={disabled || busy || savingName} onClick={() => void onLogout()}><LogOut size={16} aria-hidden="true" />Log out</button>
    </div>
  </details>;
}
