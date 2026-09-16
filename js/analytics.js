const config = window.LINUXAID_CONFIG?.analytics || {};
const STORAGE_KEY = 'linuxaid-analytics-optout';
let posthogClient = null;
let initialized = false;

function optedOut() {
  if (localStorage.getItem(STORAGE_KEY) === '1') return true;
  if (config.respectDoNotTrack !== false && navigator.doNotTrack === '1') return true;
  return false;
}

async function loadPostHog() {
  if (initialized || optedOut() || !config.posthogKey) return null;
  initialized = true;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/posthog-js@1/+esm');
    const posthog = module.default || module.posthog || module;
    posthog.init(config.posthogKey, {
      api_host:config.posthogHost || 'https://us.i.posthog.com',
      person_profiles:'identified_only',
      capture_pageview:false,
      capture_pageleave:true,
      autocapture:true,
      disable_session_recording:config.sessionReplay !== true,
      persistence:'localStorage+cookie',
      loaded(instance) {
        posthogClient = instance;
        capture('$pageview', {
          page:document.body.dataset.page || 'unknown',
          path:location.pathname,
          title:document.title
        });
      }
    });
    return posthog;
  } catch (error) {
    console.warn('LinuxAid analytics could not initialize:', error);
    return null;
  }
}

export function capture(event, properties = {}) {
  if (!posthogClient || optedOut()) return;
  try {
    posthogClient.capture(event, {
      product:'LinuxAid',
      page:document.body.dataset.page || 'unknown',
      ...properties
    });
  } catch (error) {
    console.warn('LinuxAid analytics event failed:', error);
  }
}

export function identifyAnalyticsUser(user, profile = {}) {
  if (!posthogClient || optedOut() || !user?.uid) return;
  try {
    posthogClient.identify(user.uid, {
      email:user.email || undefined,
      display_name:profile.displayName || user.displayName || undefined,
      distro:profile.distro || undefined
    });
  } catch (error) {
    console.warn('LinuxAid analytics identify failed:', error);
  }
}

export function resetAnalyticsUser() {
  try { posthogClient?.reset(); } catch {}
}

export function setAnalyticsOptOut(value) {
  localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  if (value) posthogClient?.opt_out_capturing?.();
  else posthogClient?.opt_in_capturing?.();
}

export function isAnalyticsOptedOut() {
  return optedOut();
}

function wireUsefulEvents() {
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && link.origin === location.origin) {
      capture('navigation_clicked', { destination:new URL(link.href, location.href).pathname, label:(link.textContent || '').trim().slice(0,80) });
    }
    const button = event.target.closest('button');
    if (button?.id) capture('ui_action', { control:button.id });
  }, { passive:true });

  document.addEventListener('linuxaid:course-complete', event => capture('course_progressed', event.detail || {}));
  document.addEventListener('linuxaid:lab-complete', event => capture('lab_completed', event.detail || {}));
  document.addEventListener('linuxaid:command-run', event => capture('terminal_command_run', event.detail || {}));
  document.addEventListener('linuxaid:community-post', event => capture('community_post_created', event.detail || {}));
}

wireUsefulEvents();
loadPostHog();
