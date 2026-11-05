// Talks to the private varn-ask Worker. The session token lives only in this closure (memory): it is never put in
// localStorage, sessionStorage, a cookie or the URL, so reloading the page signs you out.
export function createClient({ base, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  let token = null;
  const call = async (path, body, auth) => {
    let res;
    try {
      res = await doFetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth && token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' });
    } catch { return { error: 'network', message: 'Could not reach the assistant.' }; }
    let data = null; try { data = await res.json(); } catch { /* fall through */ }
    if (!res.ok || !data) return { error: data?.error || 'failed', message: data?.message || 'The assistant is unavailable right now.', status: res.status, retry_after_s: data?.retry_after_s };
    return { data };
  };
  return {
    get signedIn() { return token !== null; },
    signOut() { token = null; },
    async login(password) {
      const r = await call('/v1/login', { password }, false);
      if (r.data?.token) { token = r.data.token; return { ok: true }; }
      return { ok: false, ...r };
    },
    async ask(question, live) {
      if (!token) return { error: 'unauthorized', message: 'Sign in first.' };
      const r = await call('/v1/ask', { question, live }, true);
      if (r.error === 'unauthorized') token = null;
      return r.data ? { response: r.data } : r;
    },
  };
}
