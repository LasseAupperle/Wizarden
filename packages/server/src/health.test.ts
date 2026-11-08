import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createWizardenServer, type WizardenServer } from './index.js';

describe('/health', () => {
  let server: WizardenServer | undefined;
  afterEach(async () => {
    await server?.close();
  });

  it('reports ok + the server package version (no hardcoded drift)', async () => {
    server = createWizardenServer();
    const port = await server.listen(0);
    const res = await fetch(`http://localhost:${port}/health`);
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: 'wizarden-server', version: pkg.version });
  });
});
