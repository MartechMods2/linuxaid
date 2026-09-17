const config = window.LINUXAID_CONFIG?.security?.captcha || {};
let token = '';
let widgetId = null;
let loaded = false;

export function captchaConfigured() {
  return Boolean(config.enabled && config.siteKey && ['turnstile','hcaptcha'].includes(String(config.provider || '').toLowerCase()));
}

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      const timer = setInterval(() => {
        const ready = id.includes('turnstile') ? window.turnstile : window.hcaptcha;
        if (ready) { clearInterval(timer); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(timer); reject(new Error('CAPTCHA script timed out.')); }, 8000);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('CAPTCHA script could not be loaded.'));
    document.head.appendChild(script);
  });
}

export async function initCaptcha(container) {
  if (!container || !captchaConfigured()) return false;
  const provider = String(config.provider).toLowerCase();
  container.hidden = false;
  try {
    if (provider === 'turnstile') {
      await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit','linuxaid-turnstile-script');
      widgetId = window.turnstile.render(container, {
        sitekey:config.siteKey,
        theme:document.body.classList.contains('light-theme') ? 'light' : 'dark',
        callback:value => { token = value || ''; },
        'expired-callback':() => { token = ''; },
        'error-callback':() => { token = ''; }
      });
    } else {
      await loadScript('https://js.hcaptcha.com/1/api.js?render=explicit','linuxaid-hcaptcha-script');
      widgetId = window.hcaptcha.render(container, {
        sitekey:config.siteKey,
        theme:document.body.classList.contains('light-theme') ? 'light' : 'dark',
        callback:value => { token = value || ''; },
        'expired-callback':() => { token = ''; },
        'error-callback':() => { token = ''; }
      });
    }
    loaded = true;
    return true;
  } catch (error) {
    console.warn('LinuxAid CAPTCHA could not initialize:', error);
    container.hidden = true;
    return false;
  }
}

export function getCaptchaToken() { return token; }

export function resetCaptcha() {
  token = '';
  if (!loaded || widgetId === null) return;
  try {
    if (String(config.provider).toLowerCase() === 'turnstile') window.turnstile?.reset(widgetId);
    else window.hcaptcha?.reset(widgetId);
  } catch {}
}
