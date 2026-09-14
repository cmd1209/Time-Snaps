import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/calendar.js';

const url = 'https://p45-caldav.icloud.com/published/2/sample';
const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
async function call(body = { url }, method = 'POST') {
  const headers = {};
  const response = { setHeader(key, value) { headers[key] = value; }, end(body) { this.body = body; } };
  await handler({ body, method }, response);
  return { ...response, headers };
}

test('public calendar endpoint', async (t) => {
  const original = globalThis.fetch;
  try {
    await t.test('rejects unsupported methods and unsafe URLs without fetching', async () => {
      globalThis.fetch = () => { throw new Error('Must not fetch'); };
      assert.equal((await call({}, 'GET')).statusCode, 405);
      for (const value of ['http://localhost/', 'https://127.0.0.1/', 'https://p01-calendars.icloud.com.evil.test/published/2/x', 'https://user:pass@p01-calendars.icloud.com/published/2/x', 'https://p01-calendars.icloud.com:444/published/2/x', 'https://p01-calendars.icloud.com/private/x', null]) {
        assert.equal((await call({ url: value })).statusCode, 400);
      }
      assert.equal((await call('{broken')).statusCode, 400);
    });
    await t.test('returns ICS and prevents caching; normalizes webcal', async () => {
      globalThis.fetch = async (target, options) => {
        assert.equal(target.href, url);
        assert.equal(options.redirect, 'manual');
        assert.ok(options.signal);
        return new Response(ics);
      };
      const result = await call(JSON.stringify({ url: url.replace('https:', 'webcal:') }));
      assert.equal(result.statusCode, 200);
      assert.equal(result.body, ics);
      assert.equal(result.headers['Cache-Control'], 'no-store');
    });
    await t.test('blocks redirects to untrusted hosts', async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://localhost/' } }); };
      assert.equal((await call()).statusCode, 502);
      assert.equal(calls, 1);
    });
    await t.test('follows allowed redirects and bounds redirect loops', async () => {
      let calls = 0;
      globalThis.fetch = async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: url } }) : new Response(ics);
      assert.equal((await call()).statusCode, 200);
      calls = 0;
      globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: url } }); };
      assert.equal((await call()).statusCode, 502);
      assert.equal(calls, 4);
    });
    await t.test('handles invalid feeds, upstream failures and oversized bodies', async () => {
      for (const [response, status] of [[new Response('<html>Not a calendar</html>'), 502], [new Response(null, { status: 404 }), 502], [new Response('x'.repeat(3 * 1024 * 1024 + 1)), 413], [new Response(null, { headers: { 'content-length': '4000000' } }), 413]]) {
        globalThis.fetch = async () => response;
        assert.equal((await call()).statusCode, status);
      }
      globalThis.fetch = async () => { throw new Error('Private upstream details'); };
      const result = await call();
      assert.equal(result.statusCode, 502);
      assert.ok(!result.body.includes('Private upstream details'));
    });
  } finally { globalThis.fetch = original; }
});
