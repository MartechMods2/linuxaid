import {
  initBackend, getBackendStatus, getCurrentUser, onAuthStateChangedListener,
  signInWithGoogleClient, signInWithEmailClient, createAccountWithEmailClient,
  sendPasswordResetClient, updatePasswordClient
} from '../backend.js';

const config = window.LINUXAID_CONFIG || {};
await initBackend(config);
const backend = getBackendStatus();
const backendReady = backend.ready;
const params = new URLSearchParams(location.search);
let mode = params.get('mode') === 'recovery' ? 'recovery' : 'signin';
let busy = false;

const $ = id => document.getElementById(id);
const els = {
  heading:$('authHeading'), subheading:$('authSubheading'), message:$('authMessage'),
  form:$('authForm'), name:$('authName'), email:$('authPageEmail'), password:$('authPagePassword'),
  confirm:$('authConfirmPassword'), nameField:$('nameField'), confirmField:$('confirmField'),
  submit:$('authSubmit'), google:$('authGoogle'), forgot:$('forgotPassword'), demo:$('demoMode'),
  togglePassword:$('togglePassword')
};

function setMessage(text='', type='info') {
  if (!els.message) return;
  els.message.textContent = text;
  els.message.className = `auth-message ${text ? `show ${type}` : ''}`;
}

function setMode(next) {
  mode = next;
  const create = mode === 'create';
  const recovery = mode === 'recovery';

  if (recovery) {
    els.heading.textContent = 'Choose a new password';
    els.subheading.textContent = 'Set a fresh password for your LinuxAid account.';
  } else {
    els.heading.textContent = create ? 'Create your free account' : 'Welcome back';
    els.subheading.textContent = create
      ? `Create a learner account${backendReady ? ` with ${backend.provider}` : ' in browser demo mode'}.`
      : 'Sign in to sync your Linux learning journey across devices.';
  }

  if (els.nameField) els.nameField.hidden = !create;
  if (els.confirmField) els.confirmField.hidden = !(create || recovery);
  const emailLabel = els.email?.closest('label');
  if (emailLabel) emailLabel.hidden = recovery;
  if (els.password) els.password.autocomplete = create || recovery ? 'new-password' : 'current-password';
  if (els.submit) els.submit.textContent = recovery ? 'Update password' : create ? 'Create account' : 'Sign in';
  if (els.forgot) els.forgot.hidden = create || recovery;
  if (els.google) els.google.hidden = recovery;
  if (els.demo) els.demo.hidden = recovery;
  document.querySelector('.auth-divider')?.toggleAttribute('hidden', recovery);
  document.querySelector('.auth-tabs')?.toggleAttribute('hidden', recovery);

  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    const active = button.dataset.authTab === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  setMessage('');
}

function friendlyError(error) {
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '');
  if (code.includes('invalid-credential') || code.includes('invalid_login_credentials') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.';
  if (code.includes('email-already-in-use') || message.toLowerCase().includes('already registered')) return 'That email already has an account. Try signing in instead.';
  if (code.includes('weak-password') || message.toLowerCase().includes('password should')) return 'Use a stronger password with at least 8 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('popup-closed')) return 'Google sign-in was cancelled.';
  if (code.includes('too-many-requests') || code.includes('rate')) return 'Too many attempts. Wait a little and try again.';
  return message ? message.replace(/^Firebase:\s*/,'') : 'Something went wrong. Please try again.';
}

function validatePassword() {
  const password = els.password?.value || '';
  const confirm = els.confirm?.value || '';
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers in your password.';
  if (password !== confirm) return 'The passwords do not match.';
  return '';
}

function validateCreate() {
  const name = els.name?.value.trim() || '';
  const email = els.email?.value.trim() || '';
  if (name.length < 2) return 'Enter a display name with at least 2 characters.';
  if (!email.includes('@')) return 'Enter a valid email address.';
  return validatePassword();
}

function setBusy(value) {
  busy = value;
  [els.submit, els.google, els.forgot, els.demo].forEach(button => { if (button) button.disabled = value; });
  if (els.submit) els.submit.textContent = value ? 'Please wait…' : (mode === 'recovery' ? 'Update password' : mode === 'create' ? 'Create account' : 'Sign in');
}

async function handleSubmit(event) {
  event.preventDefault();
  if (busy) return;

  if (mode === 'recovery') {
    const validation = validatePassword();
    if (validation) return setMessage(validation, 'error');
    if (!backendReady) return setMessage('Connect the Supabase backend before using password recovery.', 'error');
    setBusy(true);
    try {
      await updatePasswordClient(els.password.value);
      setMessage('Password updated successfully. Redirecting…', 'success');
      setTimeout(() => location.href = 'dashboard.html', 800);
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    } finally { setBusy(false); }
    return;
  }

  const email = els.email.value.trim();
  const password = els.password.value;
  if (!email || !password) return setMessage('Enter your email and password.', 'error');

  if (!backendReady) {
    const validation = mode === 'create' ? validateCreate() : '';
    if (validation) return setMessage(validation, 'error');
    return enableDemo(els.name.value.trim() || email.split('@')[0] || 'LinuxAid Learner');
  }

  if (mode === 'create') {
    const validation = validateCreate();
    if (validation) return setMessage(validation, 'error');
  }

  setBusy(true);
  try {
    if (mode === 'create') {
      await createAccountWithEmailClient(email, password, els.name.value.trim());
      const active = await getCurrentUser();
      if (active) {
        setMessage('Account created and signed in. Redirecting…', 'success');
        setTimeout(() => location.href = 'dashboard.html', 750);
      } else {
        setMessage('Account created. Check your inbox to verify your email, then sign in.', 'success');
        setMode('signin');
        els.email.value = email;
      }
    } else {
      await signInWithEmailClient(email, password);
      setMessage('Signed in successfully. Redirecting…', 'success');
      setTimeout(() => location.href = 'dashboard.html', 650);
    }
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  } finally { setBusy(false); }
}

async function handleGoogle() {
  if (busy) return;
  if (!backendReady) return enableDemo('LinuxAid Learner');
  setBusy(true);
  try {
    await signInWithGoogleClient();
    // Supabase OAuth navigates away. Firebase returns here after popup sign-in.
    if (backend.provider === 'firebase') {
      setMessage('Google sign-in successful. Redirecting…', 'success');
      setTimeout(() => location.href = 'dashboard.html', 500);
    }
  } catch (error) {
    setMessage(friendlyError(error), 'error');
    setBusy(false);
  }
}

async function handleReset() {
  const email = els.email.value.trim();
  if (!email || !email.includes('@')) return setMessage('Enter your email first, then select “Forgot password?”.', 'error');
  if (!backendReady) return setMessage('Password reset becomes available when Supabase or Firebase is configured.', 'info');
  setBusy(true);
  try {
    await sendPasswordResetClient(email);
    setMessage('Password reset email sent. Check your inbox and spam folder.', 'success');
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  } finally { setBusy(false); }
}

function enableDemo(name='LinuxAid Learner') {
  localStorage.setItem('linuxaid-auth','true');
  localStorage.setItem('linuxaid-demo-profile', JSON.stringify({ displayName:name, createdAt:new Date().toISOString() }));
  setMessage('Browser demo mode enabled. Your progress stays on this device.', 'info');
  setTimeout(() => location.href = 'dashboard.html', 600);
}

document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authTab)));
els.form?.addEventListener('submit', handleSubmit);
els.google?.addEventListener('click', handleGoogle);
els.forgot?.addEventListener('click', handleReset);
els.demo?.addEventListener('click', () => enableDemo(els.name?.value.trim() || 'LinuxAid Learner'));
els.togglePassword?.addEventListener('click', () => {
  const show = els.password.type === 'password';
  els.password.type = show ? 'text' : 'password';
  els.togglePassword.innerHTML = `<i class="fas ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
  els.togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

if (backendReady) {
  onAuthStateChangedListener(user => {
    if (user && mode !== 'recovery') setMessage(`Signed in as ${user.displayName || user.email || 'LinuxAid learner'}.`, 'success');
  });
} else {
  setMessage('Backend not configured yet. You can still use LinuxAid in browser-only demo mode.', 'info');
}

if (params.get('verified') === '1') setMessage('Email verification complete. You can continue to LinuxAid.', 'success');
setMode(mode);
