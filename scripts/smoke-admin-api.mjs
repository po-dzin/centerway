const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const endpoints = [
  '/api/admin/analytics',
  '/api/admin/orders',
  '/api/admin/jobs',
  '/api/admin/customers',
  '/api/admin/audit',
];

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '10000', 10);

async function checkEndpoint(path) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });

    const ok = response.status === 401 || response.status === 403;
    const statusLabel = ok ? 'PASS' : 'FAIL';
    console.log(`${statusLabel} ${path} -> ${response.status} ${response.statusText || ''}`.trim());

    if (!ok) {
      let bodyPreview = '';
      try {
        bodyPreview = (await response.text()).trim().slice(0, 300);
      } catch {
        bodyPreview = '<unable to read response body>';
      }
      console.log(`  expected 401/403 without token, got ${response.status}`);
      if (bodyPreview) {
        console.log(`  body: ${bodyPreview}`);
      }
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${path} -> request error: ${message}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log(`Admin smoke base URL: ${baseUrl}`);

  const results = await Promise.all(endpoints.map((endpoint) => checkEndpoint(endpoint)));
  const failed = results.filter((result) => !result).length;

  if (failed > 0) {
    console.log(`Admin smoke failed: ${failed}/${endpoints.length} endpoints rejected public access as expected.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Admin smoke passed: ${endpoints.length}/${endpoints.length} endpoints rejected public access.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
