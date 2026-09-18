import {
  initFirebase, onAuthStateChangedListener, signInWithGoogleClient, signInWithEmailClient,
  signOutClient, loadUserChatHistory, saveUserChatHistory, loadCommunityPosts
} from './firebase.js';
import { queryAI, getAIStatus } from './gemini.js';
import { COMMAND_CATALOG } from './js/commandCatalog.js';
import { createTerminalEngine } from './js/terminalEngine.js';
import { escapeHtml, renderSafeMarkdown, safeJsonParse, clampText } from './js/security.js';
import { recordCommandUsage, renderRoadmapProgress, getProgressSummary } from './js/progress.js';

const config = window.LINUXAID_CONFIG || {};
const page = document.body.dataset.page || 'dashboard';
const terminal = createTerminalEngine();

const state = {
  user:null,
  fallbackAuth:false,
  chatHistory:[],
  commandDocs:COMMAND_CATALOG,
  suggestedPrompts:[
    'Explain chmod safely',
    'Fix permission denied',
    'How do I inspect a Linux service?',
    'Teach me file permissions',
    'What should I learn after ls and cd?'
  ]
};

const elements = {};
const listeners = new Set();

function cacheElements() {
  for (const id of ['authButton','authOverlay','closeAuth','authStatus','chatMessages','chatInput','sendChat','suggestionBar','commandGrid','commandSearch','commandCategory','terminalOutput','terminalInput','terminalHint','backToTop','loading-bar','themeToggle','authEmail','authPassword']) {
    elements[id === 'loading-bar' ? 'loadingBar' : id] = document.getElementById(id);
  }
}

function removeLoadingScreen() {
  document.getElementById('loading-screen')?.remove();
}

async function init() {
  try {
    cacheElements();
    initializeTheme();
    initializeAuth();
    setupListeners();
    renderAuthState();
    if (page === 'dashboard') {
      animateLoading();
      await initializeDashboard();
    }
  } catch (error) {
    console.error('LinuxAid initialization failed:', error);
    removeLoadingScreen();
  }
}

function initializeAuth() {
  if (config.firebase?.apiKey && initFirebase(config.firebase)) {
    onAuthStateChangedListener(handleAuthChange);
    return;
  }
  loadFallbackAuth();
}

function initializeTheme() {
  if (localStorage.getItem('linuxaid-theme') === 'light') document.body.classList.add('light-theme');
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = elements.themeToggle?.querySelector('i');
  if (icon) icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
  const light = document.body.classList.toggle('light-theme');
  localStorage.setItem('linuxaid-theme', light ? 'light' : 'dark');
  updateThemeIcon();
}

function loadFallbackAuth() {
  state.fallbackAuth = localStorage.getItem('linuxaid-auth') === 'true';
  state.user = state.fallbackAuth ? { uid:'local-demo-user', displayName:'LinuxAid Learner' } : null;
  renderAuthState();
}

function handleAuthChange(user) {
  state.user = user || null;
  state.fallbackAuth = false;
  renderAuthState();
  if (user) loadRemoteChatHistory(user.uid);
}

async function initializeDashboard() {
  loadInitialChat();
  renderSuggestions();
  renderCommands();
  renderRoadmapProgress();
  renderTerminalOutput('Welcome to LinuxAid Terminal. Type <strong>help</strong> or <strong>man ls</strong> to begin.', false);
  updateLearningStatus();
  if (config.firebase?.apiKey) loadCommunityPostsIfAvailable();
}

function setupListeners() {
  if (listeners.has('setup')) return;
  listeners.add('setup');

  elements.authButton?.addEventListener('click', () => state.user ? handleLogout() : elements.authOverlay?.classList.add('active'));
  elements.closeAuth?.addEventListener('click', closeAuthModal);
  elements.authOverlay?.addEventListener('click', event => { if (event.target === elements.authOverlay) closeAuthModal(); });
  elements.themeToggle?.addEventListener('click', toggleTheme);
  document.getElementById('googleSignIn')?.addEventListener('click', handleGoogleSignIn);
  document.getElementById('emailSignIn')?.addEventListener('click', handleEmailSignIn);
  elements.sendChat?.addEventListener('click', handleChatSend);
  elements.chatInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleChatSend(); }
  });
  elements.terminalInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); handleTerminalCommand(); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); elements.terminalInput.value = terminal.historyMove(-1); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); elements.terminalInput.value = terminal.historyMove(1); return; }
    if (event.key === 'Tab') { event.preventDefault(); elements.terminalInput.value = terminal.autocomplete(elements.terminalInput.value); }
  });
  elements.commandSearch?.addEventListener('input', renderCommands);
  elements.commandCategory?.addEventListener('change', renderCommands);
  document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
  elements.backToTop?.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));
  window.addEventListener('scroll', () => elements.backToTop?.classList.toggle('show', window.scrollY > 320));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAuthModal(); });
}

function closeAuthModal() {
  elements.authOverlay?.classList.remove('active');
}

function renderAuthState() {
  if (elements.authButton) elements.authButton.textContent = state.user ? 'Sign out' : 'Sign in';
  if (!elements.authStatus) return;
  if (state.user) elements.authStatus.textContent = `Signed in • ${state.user.displayName || 'LinuxAid learner'}`;
  else {
    const ai = getAIStatus(config);
    elements.authStatus.textContent = ai.ready ? `Not signed in • AI ${ai.provider} ready` : 'Not signed in • Local tutor ready';
  }
}

async function handleGoogleSignIn() {
  if (!config.firebase?.apiKey) return enableLocalSignIn('LinuxAid Learner');
  try {
    const user = await signInWithGoogleClient();
    state.user = user;
    renderAuthState();
    await loadRemoteChatHistory(user.uid);
    closeAuthModal();
    notify('Signed in with Google.');
  } catch (error) {
    console.error(error);
    notify('Google sign-in failed. Check Firebase configuration.');
  }
}

async function handleEmailSignIn() {
  const email = elements.authEmail?.value.trim();
  const password = elements.authPassword?.value || '';
  if (!email || !password) return notify('Fill both email and password to continue.');
  if (!config.firebase?.apiKey) return enableLocalSignIn(email.split('@')[0] || 'LinuxAid learner');
  try {
    const user = await signInWithEmailClient(email, password);
    state.user = user;
    renderAuthState();
    await loadRemoteChatHistory(user.uid);
    closeAuthModal();
    notify(`Welcome back, ${email.split('@')[0] || 'learner'}!`);
  } catch (error) {
    console.error(error);
    notify('Email sign-in failed. Check your credentials and Firebase settings.');
  }
}

function enableLocalSignIn(name) {
  state.fallbackAuth = true;
  state.user = { uid:'local-demo-user', displayName:name };
  localStorage.setItem('linuxaid-auth', 'true');
  renderAuthState();
  closeAuthModal();
  notify('Preview sign-in enabled. Firebase is not configured.');
}

async function handleLogout() {
  if (config.firebase?.apiKey && state.user && !state.fallbackAuth) {
    try { await signOutClient(); } catch (error) { console.error(error); }
  }
  state.user = null;
  state.fallbackAuth = false;
  localStorage.setItem('linuxaid-auth', 'false');
  renderAuthState();
  notify('You have been signed out.');
}

function loadInitialChat() {
  const stored = safeJsonParse(localStorage.getItem('linuxaid-chat'), null);
  state.chatHistory = Array.isArray(stored) && stored.length ? stored.slice(-60) : [
    { role:'assistant', text:'Welcome to LinuxAid. Ask about Linux commands, errors, permissions, networking, packages, or your next learning step.' }
  ];
  renderChat();
}

async function loadRemoteChatHistory(uid) {
  if (!uid || !config.firebase?.apiKey) return;
  const messages = await loadUserChatHistory(uid);
  if (messages.length) state.chatHistory = messages.slice(-60);
  renderChat();
}

function renderSuggestions() {
  if (!elements.suggestionBar) return;
  elements.suggestionBar.replaceChildren();
  state.suggestedPrompts.forEach(prompt => {
    const button = document.createElement('button');
    button.className = 'suggestion-pill';
    button.type = 'button';
    button.textContent = prompt;
    button.addEventListener('click', () => {
      if (!elements.chatInput) return;
      elements.chatInput.value = prompt;
      handleChatSend();
    });
    elements.suggestionBar.appendChild(button);
  });
}

function renderChat() {
  if (!elements.chatMessages) return;
  elements.chatMessages.replaceChildren();
  state.chatHistory.forEach(item => {
    const message = document.createElement('div');
    message.className = `chat-message ${item.role === 'user' ? 'user' : 'assistant'}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.role === 'assistant' ? 'LinuxAid' : 'You';
    const content = document.createElement('div');
    // renderSafeMarkdown escapes HTML first, preventing stored/model XSS.
    content.innerHTML = renderSafeMarkdown(clampText(item.text, 12000));
    message.append(meta, content);
    elements.chatMessages.appendChild(message);
  });
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function handleChatSend() {
  const text = elements.chatInput?.value.trim();
  if (!text) return;
  if (!state.user) { elements.authOverlay?.classList.add('active'); return; }
  state.chatHistory.push({ role:'user', text:clampText(text,6000) });
  state.chatHistory = state.chatHistory.slice(-60);
  elements.chatInput.value = '';
  renderChat();
  await sendAIResponse(text);
}

async function sendAIResponse(text) {
  const responseNode = { role:'assistant', text:'LinuxAid is thinking...' };
  state.chatHistory.push(responseNode);
  renderChat();
  try {
    const status = getAIStatus(config);
    responseNode.text = status.ready
      ? await queryAI(text, config, state.chatHistory.slice(0,-1))
      : generateLocalAIAnswer(text);
  } catch (error) {
    console.error(error);
    responseNode.text = `${generateLocalAIAnswer(text)}\n\n**AI connection note:** ${error.message || 'Remote AI is unavailable.'} LinuxAid used its local safety tutor instead.`;
  }
  state.chatHistory = state.chatHistory.slice(-60);
  renderChat();
  saveChat();
}

function generateLocalAIAnswer(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes('permission denied')) return 'Start by inspecting the target with `ls -l <file>` and your identity with `id`. If it is your file and only execute permission is missing, `chmod +x <file>` may be enough. Avoid jumping straight to sudo.';
  if (lower.includes('chmod')) return '`chmod` changes Linux permission bits. Common modes are `644` for normal files and `755` for executable scripts/directories. Avoid `chmod 777` unless you fully understand why everyone needs write access.';
  if (lower.includes('sudo')) return '`sudo` runs a command with elevated privileges. First ask: can this be done without root? Inspect the command and target path before using sudo.';
  if (lower.includes('systemctl') || lower.includes('service')) return 'For a systemd service, inspect first with `systemctl status <service>` and `journalctl -u <service> --since today`. Restart only after you understand the error.';
  if (lower.includes('install') || lower.includes('package')) return 'Package commands depend on your distro: Ubuntu/Debian use `apt`, Fedora uses `dnf`, and Arch uses `pacman`. Tell me your distro and package name for the safest exact steps.';
  if (lower.includes('network') || lower.includes('internet') || lower.includes('dns')) return 'Diagnose networking from simple to specific: `ip addr`, `ip route`, `ping -c 4 1.1.1.1`, then test DNS with a hostname. This separates interface, routing, internet, and DNS problems.';
  if (lower.includes('beginner') || lower.includes('learn') || lower.includes('next')) return 'Build confidence in this order: `pwd` → `ls` → `cd` → `cat` → `mkdir`/`touch` → `cp`/`mv` → `grep`/`find` → permissions. Practice each in the simulator and use `man <command>`.';
  return 'Use the LinuxAid workflow: **inspect first**, understand the target, make the smallest change, then verify the result. You can ask me to explain a command, interpret an error, compare distro commands, or plan a safe troubleshooting sequence.';
}

function saveChat() {
  const safeHistory = state.chatHistory.slice(-60).map(item => ({ role:item.role === 'user' ? 'user' : 'assistant', text:clampText(item.text,12000) }));
  if (config.firebase?.apiKey && state.user && !state.fallbackAuth) saveUserChatHistory(state.user.uid, safeHistory);
  localStorage.setItem('linuxaid-chat', JSON.stringify(safeHistory));
}

function renderCommands() {
  if (!elements.commandGrid) return;
  const query = elements.commandSearch?.value.toLowerCase().trim() || '';
  const category = elements.commandCategory?.value || 'all';
  elements.commandGrid.replaceChildren();
  const matches = state.commandDocs.filter(cmd => {
    const haystack = `${cmd.name} ${cmd.syntax} ${cmd.explanation} ${cmd.related.join(' ')}`.toLowerCase();
    return (!query || haystack.includes(query)) && (category === 'all' || cmd.category === category);
  });
  matches.forEach(cmd => elements.commandGrid.appendChild(buildCommandCard(cmd)));
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'hint-box';
    empty.textContent = 'No commands match those filters.';
    elements.commandGrid.appendChild(empty);
  }
}

function buildCommandCard(cmd) {
  const card = document.createElement('div');
  card.className = 'command-card glass';
  const header = document.createElement('div');
  header.className = 'command-header';
  const title = document.createElement('h4'); title.textContent = cmd.name;
  const badge = document.createElement('span'); badge.className = `badge ${cmd.safety}`; badge.textContent = cmd.safety;
  header.append(title,badge);
  const syntax = document.createElement('div'); syntax.className = 'syntax'; syntax.textContent = cmd.syntax;
  const body = document.createElement('p'); body.textContent = cmd.explanation;
  const examples = document.createElement('ul');
  cmd.examples.forEach(example => { const li = document.createElement('li'); li.textContent = example; examples.appendChild(li); });
  const related = document.createElement('p'); related.textContent = `Related: ${cmd.related.join(', ')}`;
  const warning = document.createElement('p'); warning.style.color = '#ff8a8a'; warning.style.fontWeight = '600'; warning.textContent = cmd.warning;
  const actions = document.createElement('div'); actions.className = 'action-row';
  const copy = document.createElement('button'); copy.className = 'button'; copy.type = 'button'; copy.textContent = 'Copy syntax'; copy.addEventListener('click', () => copyText(cmd.syntax));
  const tryButton = document.createElement('button'); tryButton.className = 'button'; tryButton.type = 'button'; tryButton.textContent = 'Try command'; tryButton.addEventListener('click', () => {
    if (!elements.terminalInput) return;
    elements.terminalInput.value = cmd.examples[0] || cmd.name;
    document.getElementById('terminal')?.scrollIntoView({ behavior:'smooth' });
    elements.terminalInput.focus();
  });
  actions.append(copy,tryButton);
  card.append(header,syntax,body,examples,related,warning,actions);
  return card;
}

function resetFilters() {
  if (elements.commandSearch) elements.commandSearch.value = '';
  if (elements.commandCategory) elements.commandCategory.value = 'all';
  renderCommands();
}

function copyText(value) {
  navigator.clipboard?.writeText(value).then(() => notify('Copied to clipboard'), () => notify('Copy failed'));
}

function handleTerminalCommand() {
  const raw = elements.terminalInput?.value.trim();
  if (!raw) return;
  const result = terminal.execute(raw);
  if (result.clear) elements.terminalOutput?.replaceChildren();
  else renderTerminalOutput(`${escapeHtml(`linuxaid@${terminal.state.host}:${terminal.state.cwd}$ ${raw}`)}\n${escapeHtml(result.output)}`, true);
  elements.terminalInput.value = '';
  if (result.command && !result.blocked) recordCommandUsage(result.command);
  renderRoadmapProgress();
  updateLearningStatus();
  if (elements.terminalHint) {
    elements.terminalHint.textContent = `${result.safety.level.toUpperCase()} • ${result.safety.reason}`;
    elements.terminalHint.dataset.safety = result.safety.level;
  }
}

function renderTerminalOutput(content, preformatted = false) {
  if (!elements.terminalOutput) return;
  const row = document.createElement('div');
  if (preformatted) {
    const pre = document.createElement('pre');
    pre.className = 'terminal-result';
    pre.innerHTML = content;
    row.appendChild(pre);
  } else row.innerHTML = content;
  elements.terminalOutput.appendChild(row);
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

function updateLearningStatus() {
  const summary = getProgressSummary();
  const panel = document.getElementById('terminalHint');
  if (panel && !panel.dataset.safety) panel.textContent = `Learning: ${summary.level} • ${summary.xp} XP • ${summary.learnedCommands.length} commands explored • ${summary.streakDays} day streak`;
}

async function loadCommunityPostsIfAvailable() {
  try {
    const posts = await loadCommunityPosts();
    if (!posts.length) return;
    const grid = document.querySelector('.community-grid');
    if (!grid) return;
    grid.replaceChildren();
    posts.slice(0,6).forEach(post => {
      const card = document.createElement('div'); card.className = 'community-card glass';
      const title = document.createElement('h3'); title.textContent = clampText(post.title || 'Community post',160);
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = clampText(post.meta || 'Latest discussion',200);
      const body = document.createElement('p'); body.textContent = clampText(post.body || 'No content',1200);
      const actions = document.createElement('div'); actions.className = 'community-actions';
      const replies = document.createElement('span'); replies.className = 'community-pill'; replies.textContent = `${Number(post.replies) || 0} replies`;
      const upvotes = document.createElement('span'); upvotes.className = 'community-pill'; upvotes.textContent = `upvotes ${Number(post.upvotes) || 0}`;
      actions.append(replies,upvotes); card.append(title,meta,body,actions); grid.appendChild(card);
    });
  } catch (error) {
    console.warn('Unable to load community posts:', error);
  }
}

function notify(message) {
  const toast = document.createElement('div');
  toast.className = 'linuxaid-toast';
  toast.textContent = message;
  Object.assign(toast.style,{ position:'fixed', bottom:'24px', right:'24px', padding:'14px 18px', borderRadius:'16px', background:'rgba(3,6,12,.96)', color:'#d6f7cd', border:'1px solid rgba(101,255,141,.18)', boxShadow:'0 18px 50px rgba(0,0,0,.32)', zIndex:'9999', opacity:'1', transition:'opacity .35s ease' });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(),450); },2200);
}

function animateLoading() {
  if (!elements.loadingBar) { removeLoadingScreen(); return; }
  let progress = 0;
  const interval = setInterval(() => {
    progress += 18;
    elements.loadingBar.style.width = `${Math.min(progress,100)}%`;
    if (progress >= 100) { clearInterval(interval); removeLoadingScreen(); }
  },90);
  setTimeout(() => { clearInterval(interval); removeLoadingScreen(); },2500);
}

window.addEventListener('error', removeLoadingScreen);
window.addEventListener('unhandledrejection', removeLoadingScreen);
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
else init();

export { renderCommands, resetFilters, generateLocalAIAnswer };
