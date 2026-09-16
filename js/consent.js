const CONSENT_KEY = 'linuxaid-consent-v1';

export function readConsent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return { essential:true, analytics:parsed.analytics === true, updatedAt:parsed.updatedAt || null };
  } catch { return null; }
}

export function writeConsent({ analytics=false } = {}) {
  const value = { essential:true, analytics:Boolean(analytics), updatedAt:new Date().toISOString() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  document.dispatchEvent(new CustomEvent('linuxaid:consent-changed', { detail:value }));
  return value;
}

export function analyticsAllowed() {
  const consent = readConsent();
  return Boolean(consent?.analytics) && navigator.doNotTrack !== '1';
}

function addConsentBanner() {
  if (readConsent() || document.querySelector('.consent-banner')) return;
  const banner = document.createElement('aside');
  banner.className = 'consent-banner';
  banner.setAttribute('role','dialog');
  banner.setAttribute('aria-label','LinuxAid privacy choices');
  banner.innerHTML = `
    <div class="consent-grid">
      <div class="consent-copy">
        <strong>Your privacy choices</strong>
        <p>LinuxAid uses essential browser storage for theme, terminal and login session behaviour. Optional analytics only starts if you allow it. We do not sell personal data.</p>
      </div>
      <div class="consent-actions">
        <a href="privacy.html">Privacy</a>
        <button type="button" data-consent-essential>Essential only</button>
        <button type="button" class="accept" data-consent-analytics>Allow analytics</button>
      </div>
    </div>`;
  document.body.appendChild(banner);
  const finish = analytics => {
    writeConsent({ analytics });
    banner.hidden = true;
    setTimeout(() => banner.remove(), 80);
  };
  banner.querySelector('[data-consent-essential]')?.addEventListener('click', () => finish(false));
  banner.querySelector('[data-consent-analytics]')?.addEventListener('click', () => finish(true));
}

function wirePrivacySettings() {
  document.querySelectorAll('[data-open-privacy-settings]').forEach(button => {
    button.addEventListener('click', () => {
      localStorage.removeItem(CONSENT_KEY);
      addConsentBanner();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { addConsentBanner(); wirePrivacySettings(); }, { once:true });
} else {
  addConsentBanner();
  wirePrivacySettings();
}
