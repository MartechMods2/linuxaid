import {
  initFirebase, onAuthStateChangedListener, signInWithGoogleClient,
  signInWithEmailClient, createAccountWithEmailClient, sendPasswordResetClient
} from '../firebase.js';

const config = window.LINUXAID_CONFIG || {};
const firebaseReady = Boolean(config.firebase?.apiKey && config.firebase?.projectId && initFirebase(config.firebase));
let mode = 'signin';
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
  els.message.textContent = text;
  els.message.className = `auth-message ${text ? `show ${type}` : ''}`;
}

function setMode(next) {
  mode = next;
  const create = mode === 'create';
  els.heading.textContent = create ? 'Create your free account' : 'Welcome back';
  els.subheading.textContent = create
    ? 'Start a learner profile you can sync when Firebase is enabled.'
    : 'Sign in to continue your Linux learning journey.';
  els.nameField.hidden = !create;
  els.confirmField.hidden = !create;
  els.password.autocomplete = create ? 'new-password' : 'current-password';
  els.submit.textContent = create ? 'Create account' : 'Sign in';
  els.forgot.hidden = create;
  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    const active = button.dataset.authTab === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  setMessage('');
}

function friendlyError(error) {
  const code = String(error?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.';
  if (code.includes('email-already-in-use')) return 'That email already has an account. Try signing in instead.';
  if (code.includes('weak-password')) return 'Use a stronger password with at least 8 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('popup-closed')) return 'Google sign-in was cancelled.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little and try again.';
  return error?.message ? String(error.message).replace(/^Firebase:\s*/,'') : 'Something went wrong. Please try again.';
}

function validateCreate() {
  const name = els.name.value.trim();
  const email = els.email.value.trim();
  const password = els.password.value;
  const confirm = els.confirm.value;
  if (name.length < 2) return 'Enter a display name with at least 2 characters.';
  if (!email.includes('@')) return 'Enter a valid email address.';
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers in your password.';
  if (password !== confirm) return 'The passwords do not match.';
  return '';
}

function setBusy(value) {
  busy = value;
  [els.submit, els.google, els.forgot, els.demo].forEach(button => { if (button) button.disabled = value; });
  if (els.submit) els.submit.textContent = value ? 'Please wait…' : (mode === 'create' ? 'Create account' : 'Sign in');
}

async function handleSubmit(event) {
  event.preventDefault();
  if (busy) return;
  const email = els.email.value.trim();
  const password = els.password.value;
  if (!email || !password) return setMessage('Enter your email and password.', 'error');

  if (!firebaseReady) {
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
      setMessage('Account created. Check your inbox for an email verification link. Redirecting…', 'success');
    } else {
      await signInWithEmailClient(email, password);
      setMessage('Signed in successfully. Redirecting…', 'success');
    }
    setTimeout(() => location.href = 'dashboard.html', 750);
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function handleGoogle() {
  if (busy) return;
  if (!firebaseReady) return enableDemo('LinuxAid Learner');
  setBusy(true);
  try {
    await signInWithGoogleClient();
    setMessage('Google sign-in successful. Redirecting…', 'success');
    setTimeout(() => location.href = 'dashboard.html', 650);
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function handleReset() {
  const email = els.email.value.trim();
  if (!email || !email.includes('@')) return setMessage('Enter your email first, then select “Forgot password?”.', 'error');
  if (!firebaseReady) return setMessage('Password reset becomes available when Firebase Authentication is configured.', 'info');
  setBusy(true);
  try {
    await sendPasswordResetClient(email);
    setMessage('Password reset email sent. Check your inbox and spam folder.', 'success');
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  } finally {
    setBusy(false);
  }
}

function enableDemo(name='LinuxAid Learner') {
  localStorage.setItem('linuxaid-auth','true');
  localStorage.setItem('linuxaid-demo-profile', JSON.stringify({ displayName:name, createdAt:new Date().toISOString() }));
  setMessage('Demo mode enabled. Your progress will stay on this browser until Firebase is configured.', 'info');
  setTimeout(() => location.href = 'dashboard.html', 700);
}

document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authTab)));
els.form?.addEventListener('submit', handleSubmit);
els.google?.addEventListener('click', handleGoogle);
els.forgot?.addEventListener('click', handleReset);
els.demo?.addEventListener('click', () => enableDemo(els.name.value.trim() || 'LinuxAid Learner'));
els.togglePassword?.addEventListener('click', () => {
  const show = els.password.type === 'password';
  els.password.type = show ? 'text' : 'password';
  els.togglePassword.innerHTML = `<i class="fas ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
  els.togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

if (firebaseReady) {
  onAuthStateChangedListener(user => {
    if (user) setMessage(`Signed in as ${user.displayName || user.email || 'LinuxAid learner'}.`, 'success');
  });
} else {
  setMessage('Firebase is not configured yet. You can still use LinuxAid in browser-only demo mode.', 'info');
}

setMode('signin');
