export async function handler(params, ctx) {
  const { method = 'GET', url, body, headers } = params;

  if (!url) throw new Error('URL is required for Curl plugin');

  let reqHeaders = { 'Content-Type': 'application/json' };
  if (headers) {
    try {
      reqHeaders = {
        ...reqHeaders,
        ...(typeof headers === 'string' ? JSON.parse(headers) : headers),
      };
    } catch (e) {
      if (typeof headers === 'string') {
        const lines = headers.split('\n');
        for (const line of lines) {
          const idx = line.indexOf(':');
          if (idx !== -1) {
            const key = line.substring(0, idx).trim();
            const val = line.substring(idx + 1).trim();
            if (key) reqHeaders[key] = val;
          }
        }
      }
    }
  }

  let reqBody = undefined;
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    try {
      reqBody = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      reqBody = body; // fallback to string
    }
  }

  const finalBody = (typeof reqBody === 'object' && reqBody !== null) ? JSON.stringify(reqBody) : reqBody;

  ctx.logger.info(`[CurlPlugin] Sending ${method} request to ${url}`);

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: finalBody,
  });

  const contentType = response.headers.get('content-type');
  let responseData;
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  return {
    success: response.ok,
    result: {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    },
  };
}
