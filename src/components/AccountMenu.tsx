import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AccountMenuProps {
  userId: string;
  email: string;
  disabled: boolean;
  onLogout: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again.';
  return /bucket not found/i.test(message) ? 'Avatar uploads are not set up yet. Please finish the avatar storage setup in Supabase.' : message;
}

export function AccountMenu({ userId, email, disabled, onLogout }: AccountMenuProps) {
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
    <summary className="header-avatar flex cursor-pointer list-none items-center justify-center overflow-hidden rounded-full bg-cyan-100 text-sm font-medium text-cyan-700 [&::-webkit-details-marker]:hidden" aria-label="Account menu">
      {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initial}
    </summary>
    <div className="account-panel text-ink">
      <p className="text-sm [overflow-wrap:anywhere]">{email}</p>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-100 text-lg text-cyan-700">
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
      <p className="text-xs text-zinc-500">JPEG, PNG, or WebP · up to 2 MB. Uploads save automatically.</p>
      {avatar && <button type="button" className="ghost-button mb-3 text-sm" disabled={blocked} onClick={() => void remove()}>Remove avatar</button>}
      {loading && <p role="status" className="text-sm">Loading avatar...</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <div role="alert" className="mb-3 text-sm text-red-700"><p>{error}</p><button type="button" className="ghost-button" disabled={blocked} onClick={() => setAttempt(value => value + 1)}>Retry loading avatar</button></div>}
      <button type="button" className="secondary-button flex items-center gap-2" disabled={disabled || busy} onClick={() => void onLogout()}><LogOut size={16} aria-hidden="true" />Log out</button>
    </div>
  </details>;
}
