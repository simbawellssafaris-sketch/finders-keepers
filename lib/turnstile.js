// Cloudflare Turnstile (free CAPTCHA), invisible to most visitors. Only active when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set;
// otherwise getTurnstileToken() returns null and the site relies on the other spam checks.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

let loading = null;
let widgetId = null;
let waiting = null;

function load() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => {
        loading = null;
        reject(new Error('Turnstile could not be loaded'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// Resolves with a one-time token, or null when Turnstile is off or fails (the server then decides what to do).
export async function getTurnstileToken() {
  if (!SITE_KEY) return null;
  try {
    const turnstile = await load();
    return await new Promise((resolve) => {
      const done = (token) => {
        if (waiting) waiting(token);
      };
      waiting = (token) => {
        waiting = null;
        clearTimeout(timer);
        resolve(token || null);
      };
      const timer = setTimeout(() => waiting && waiting(null), 10000);
      if (widgetId === null) {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483000';
        document.body.appendChild(box);
        widgetId = turnstile.render(box, {
          sitekey: SITE_KEY,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: done,
          'error-callback': () => done(null),
          'expired-callback': () => done(null),
        });
      } else {
        turnstile.reset(widgetId);
      }
      turnstile.execute(widgetId);
    });
  } catch {
    return null;
  }
}
