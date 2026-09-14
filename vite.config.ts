import react from '@vitejs/plugin-react';
import { IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import { defineConfig } from 'vite';

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      resolve(body);
    });

    request.on('error', reject);
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'calendar-proxy',
      configureServer(server) {
        server.middlewares.use('/api/calendar', async (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Method not allowed.' }));
            return;
          }

          try {
            const rawBody = await readRequestBody(request);
            const parsedBody = JSON.parse(rawBody) as { url?: string };
            const targetUrl = parsedBody.url;

            if (!targetUrl) {
              response.statusCode = 400;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: 'Calendar URL is required.' }));
              return;
            }

            const normalizedUrl = new URL(targetUrl);
            const upstreamResponse = await fetch(normalizedUrl, {
              headers: {
                Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8',
                'User-Agent': 'Time-Snaps-Local-Prototype'
              }
            });

            if (!upstreamResponse.ok) {
              response.statusCode = upstreamResponse.status;
              response.setHeader('Content-Type', 'application/json');
              response.end(
                JSON.stringify({
                  error: `Upstream calendar request failed with ${upstreamResponse.status} ${upstreamResponse.statusText}.`
                })
              );
              return;
            }

            const text = await upstreamResponse.text();

            response.statusCode = 200;
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            response.end(text);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unable to fetch the calendar feed.';

            response.statusCode = 502;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: message }));
          }
        });
      }
    }
  ]
});
