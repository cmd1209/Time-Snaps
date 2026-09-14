import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const configured = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'TEST_USER_A_EMAIL', 'TEST_USER_A_PASSWORD', 'TEST_USER_B_EMAIL', 'TEST_USER_B_PASSWORD'].every(key => env[key]);

test('calendar CRUD and two-user RLS isolation', { skip: !configured }, async () => {
  const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const a = client(), b = client(), anonymous = client();
  const ids = [randomUUID(), randomUUID()];
  try {
    const first = await a.auth.signInWithPassword({ email: env.TEST_USER_A_EMAIL, password: env.TEST_USER_A_PASSWORD });
    const second = await b.auth.signInWithPassword({ email: env.TEST_USER_B_EMAIL, password: env.TEST_USER_B_PASSWORD });
    assert.ifError(first.error); assert.ifError(second.error);
    const owner = first.data.user.id;
    assert.notEqual(owner, second.data.user.id, 'Use two different accounts');
    const fixture = { id: ids[0], user_id: owner, name: 'Temporary RLS test', calendar_url: 'https://p45-caldav.icloud.com/published/2/test' };
    assert.ifError((await a.from('calendars').insert(fixture)).error);
    const own = await a.from('calendars').select('id').eq('id', ids[0]);
    assert.ifError(own.error); assert.equal(own.data.length, 1);
    const other = await b.from('calendars').select('id').eq('id', ids[0]);
    assert.ifError(other.error); assert.deepEqual(other.data, []);
    const signedOut = await anonymous.from('calendars').select('id').eq('id', ids[0]);
    assert.ok(signedOut.error || signedOut.data.length === 0);
    assert.ok((await b.from('calendars').insert({ ...fixture, id: ids[1] })).error);
    const updateOther = await b.from('calendars').update({ name: 'Forbidden' }).eq('id', ids[0]).select('id');
    assert.ifError(updateOther.error); assert.deepEqual(updateOther.data, []);
    const deleteOther = await b.from('calendars').delete().eq('id', ids[0]).select('id');
    assert.ifError(deleteOther.error); assert.deepEqual(deleteOther.data, []);
    assert.ok((await a.from('calendars').update({ user_id: second.data.user.id }).eq('id', ids[0])).error);
    assert.ifError((await a.from('calendars').upsert({ ...fixture, name: 'Updated test' })).error);
    const updated = await a.from('calendars').select('name').eq('id', ids[0]).single();
    assert.ifError(updated.error); assert.equal(updated.data.name, 'Updated test');
    const deleted = await a.from('calendars').delete().eq('id', ids[0]).select('id');
    assert.ifError(deleted.error); assert.equal(deleted.data.length, 1);
  } finally {
    // Clean only this run's random fixture IDs, even if a policy test failed.
    for (const instance of [a, b]) {
      const cleanup = await instance.from('calendars').delete().in('id', ids);
      if (cleanup.error) console.error('Test fixture cleanup failed:', cleanup.error.message);
      await instance.auth.signOut({ scope: 'local' });
    }
  }
});
