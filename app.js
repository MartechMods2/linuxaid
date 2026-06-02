import { initFirebase, onAuthStateChangedListener, signInWithGoogleClient, signInWithEmailClient, signOutClient, loadUserChatHistory, saveUserChatHistory, loadCommunityPosts } from './firebase.js';
import { queryGemini } from './gemini.js';

const config = window.LINUXAID_CONFIG || {};
const page = document.body.dataset.page || 'dashboard';

const state = {
  user: null,
  fallbackAuth: false,
  chatHistory: [],
  commandDocs: [
    { name:'ls', category:'file management', syntax:'ls [options] [path]', examples:['ls -la', 'ls /home'], explanation:'List directory contents with optional flags for details and hidden files.', warning:'Safe command. Use it to inspect files before modifying them.', safety:'safe', related:['pwd','cd'] },
    { name:'cd', category:'file management', syntax:'cd [directory]', examples:['cd /home', 'cd ..'], explanation:'Change your current working directory in the shell.', warning:'Medium risk if you navigate into restricted directories. Avoid using `cd /` without purpose.', safety:'medium', related:['pwd','ls'] },
    { name:'sudo', category:'permissions', syntax:'sudo <command>', examples:['sudo apt update', 'sudo chmod 755 script.sh'], explanation:'Run a command with elevated privileges. Use sparingly and only when necessary.', warning:'High risk. Invalid sudo commands can alter system files.', safety:'high', related:['chmod','chown'] },
    { name:'chmod', category:'permissions', syntax:'chmod [mode] <file>', examples:['chmod 755 script.sh', 'chmod 644 document.txt'], explanation:'Change file or directory permissions to control read, write, and execute access.', warning:'High risk when used with 777. Prefer narrow permissions for safety.', safety:'high', related:['sudo','chown'] },
    { name:'rm', category:'file management', syntax:'rm [options] <file>', examples:['rm old.log', 'rm -rf /tmp/test'], explanation:'Remove files or directories. Use with care because deletions are permanent in a real shell.', warning:'Extreme risk for `rm -rf /` or wildcards. Never run on real system without verifying.', safety:'extreme', related:['mv','cp'] },
    { name:'cp', category:'file management', syntax:'cp [options] source destination', examples:['cp file.txt backup.txt', 'cp -r folder destination/'], explanation:'Copy files or directories from one location to another.', warning:'Medium risk if you overwrite files unexpectedly.', safety:'medium', related:['mv','rm'] },
    { name:'mv', category:'file management', syntax:'mv [options] source destination', examples:['mv old.txt new.txt', 'mv ~/file /tmp/'], explanation:'Move or rename files and directories on the filesystem.', warning:'Medium risk if you overwrite existing files. Verify target paths.', safety:'medium', related:['cp','rm'] },
    { name:'mkdir', category:'file management', syntax:'mkdir [options] <directory>', examples:['mkdir projects', 'mkdir -p /tmp/new/app'], explanation:'Create new directories. Use `-p` to create parent directories automatically.', warning:'Safe command. Verify path when using nested directories.', safety:'safe', related:['cd','rm'] },
    { name:'touch', category:'file management', syntax:'touch <file>', examples:['touch notes.txt', 'touch /tmp/newfile'], explanation:'Create an empty file or update an existing file timestamp.', warning:'Safe command, but be mindful of overwriting files with the same name in scripts.', safety:'safe', related:['nano','vim'] },
    { name:'cat', category:'file management', syntax:'cat <file>', examples:['cat README.md', 'cat /etc/hosts'], explanation:'Display the contents of a file in the terminal.', warning:'Safe command. Avoid `cat` on binary files to prevent unreadable output.', safety:'safe', related:['less','grep'] },
    { name:'echo', category:'shell scripting', syntax:'echo [text]', examples:['echo Hello LinuxAid', 'echo $PATH'], explanation:'Print text or variables to the terminal, useful in scripts and command testing.', warning:'Safe command when used normally. Avoid accidental redirection to important files.', safety:'safe', related:['printf','cat'] }
  ],
  terminal: {
    cwd: '/home/linuxaid',
    fileSystem: {
      '/home/linuxaid': ['projects','README.md','notes.txt'],
      '/home/linuxaid/projects': ['starter.sh','learn-linux.txt']
    }
  },
  suggestedPrompts: [
    'Explain chmod',
    'What does sudo do?',
    'Fix permission denied',
    'How to install packages'
  ]
};

const elements = {};

function cacheElements() {
  elements.authButton = document.getElementById('authButton');
  elements.authOverlay = document.getElementById('authOverlay');
  elements.closeAuth = document.getElementById('closeAuth');
  elements.authStatus = document.getElementById('authStatus');
  elements.chatMessages = document.getElementById('chatMessages');
  elements.chatInput = document.getElementById('chatInput');
  elements.sendChat = document.getElementById('sendChat');
  elements.suggestionBar = document.getElementById('suggestionBar');
  elements.commandGrid = document.getElementById('commandGrid');
  elements.commandSearch = document.getElementById('commandSearch');
  elements.commandCategory = document.getElementById('commandCategory');
  elements.terminalOutput = document.getElementById('terminalOutput');
  elements.terminalInput = document.getElementById('terminalInput');
  elements.backToTop = document.getElementById('backToTop');
  elements.loadingBar = document.getElementById('loading-bar');
  elements.themeToggle = document.getElementById('themeToggle');
  elements.authEmail = document.getElementById('authEmail');
  elements.authPassword = document.getElementById('authPassword');
}

async function removeLoadingScreen() {
  document.getElementById('loading-screen')?.remove();
}

async function init() {
  try {
    cacheElements();
    initializeTheme();
    
    if (config.firebase?.apiKey) {
      const fbInitialized = initFirebase(config.firebase);
      if (fbInitialized) {
        onAuthStateChangedListener(handleAuthChange);
      } else {
        loadFallbackAuth();
      }
    } else {
      loadFallbackAuth();
    }

    renderAuthState();
    setupListeners();

    if (page === 'dashboard') {
      animateLoading();
      await initializeDashboard();
    }
  } catch (error) {
    console.error('LinuxAid initialization failed:', error);
    removeLoadingScreen();
  }
}

function initializeTheme() {
  const storedTheme = localStorage.getItem('linuxaid-theme');
  if (storedTheme === 'light') {
    document.body.classList.add('light-theme');
  }
  if (elements.themeToggle) {
    updateThemeIcon();
    elements.themeToggle.addEventListener('click', toggleTheme);
  }
}

function updateThemeIcon() {
  const icon = elements.themeToggle?.querySelector('i');
  if (!icon) return;
  icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('linuxaid-theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}

function loadFallbackAuth() {
  state.fallbackAuth = localStorage.getItem('linuxaid-auth') === 'true';
  if (state.fallbackAuth) {
    state.user = { uid: 'local-demo-user', displayName: 'LinuxAid Learner' };
  }
  renderAuthState();
}

function handleAuthChange(user) {
  state.user = user || null;
  state.fallbackAuth = !user;
  renderAuthState();
  if (user) {
    loadRemoteChatHistory(user.uid);
  }
}

async function initializeDashboard() {
  loadInitialChat();
  renderSuggestions();
  renderCommands();
  renderTerminalOutput('Welcome to LinuxAid Simulator. Type <span style="color:var(--green);">help</span> to explore commands.');
  if (config.firebase?.apiKey) {
    loadCommunityPostsIfAvailable();
  }
}

const listeners = new Set();

function setupListeners() {
  if (listeners.has('setup')) return;
  listeners.add('setup');

  if (elements.authButton) {
    elements.authButton.addEventListener('click', () => {
      if (state.user) {
        return handleLogout();
      }
      elements.authOverlay?.classList.add('active');
    });
  }

  if (elements.closeAuth) {
    elements.closeAuth.addEventListener('click', () => elements.authOverlay?.classList.remove('active'));
  }

  const shouldDelegateAuth = !elements.authButton;
  const shouldDelegateTheme = !elements.themeToggle;

  if (shouldDelegateAuth || shouldDelegateTheme) {
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (shouldDelegateAuth) {
        const authBtn = event.target.closest('#authButton');
        if (authBtn) {
          if (state.user) {
            return handleLogout();
          }
          elements.authOverlay?.classList.add('active');
        }
      }
      if (shouldDelegateTheme) {
        const themeBtn = event.target.closest('#themeToggle');
        if (themeBtn) {
          toggleTheme();
        }
      }
    });
  }

  const googleSignIn = document.getElementById('googleSignIn');
  if (googleSignIn) {
    googleSignIn.addEventListener('click', handleGoogleSignIn);
    listeners.add('google-signin');
  }

  const emailSignIn = document.getElementById('emailSignIn');
  if (emailSignIn) {
    emailSignIn.addEventListener('click', handleEmailSignIn);
    listeners.add('email-signin');
  }

  if (elements.sendChat) {
    elements.sendChat.addEventListener('click', handleChatSend);
    listeners.add('send-chat');
  }

  if (elements.chatInput) {
    elements.chatInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleChatSend();
      }
    });
    listeners.add('chat-input');
  }

  if (elements.terminalInput) {
    elements.terminalInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleTerminalCommand();
      }
    });
    listeners.add('terminal-input');
  }

  if (elements.commandSearch) {
    elements.commandSearch.addEventListener('input', renderCommands);
    listeners.add('command-search');
  }

  if (elements.commandCategory) {
    elements.commandCategory.addEventListener('change', renderCommands);
    listeners.add('command-category');
  }

  const resetFilters = document.getElementById('resetFilters');
  if (resetFilters) {
    resetFilters.addEventListener('click', () => {
      if (!elements.commandSearch || !elements.commandCategory) return;
      elements.commandSearch.value = '';
      elements.commandCategory.value = 'all';
      renderCommands();
    });
    listeners.add('reset-filters');
  }

  if (!listeners.has('scroll')) {
    window.addEventListener('scroll', () => {
      const isVisible = window.scrollY > 320;
      elements.backToTop?.classList.toggle('show', isVisible);
    });
    listeners.add('scroll');
  }

  if (elements.backToTop) {
    elements.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    listeners.add('back-to-top');
  }
}

function renderAuthState() {
  if (elements.authButton) {
    elements.authButton.textContent = state.user ? 'Sign out' : 'Sign in';
  }
  if (!elements.authStatus) return;
  if (state.user) {
    elements.authStatus.textContent = `Signed in • ${state.user.displayName || 'LinuxAid learner'}`;
  } else {
    elements.authStatus.textContent = 'Not signed in';
  }
}

async function handleGoogleSignIn() {
  if (config.firebase?.apiKey) {
    try {
      const user = await signInWithGoogleClient();
      state.user = user;
      renderAuthState();
      loadRemoteChatHistory(user.uid);
      elements.authOverlay?.classList.remove('active');
      notify('Signed in with Google.');
    } catch (error) {
      console.error(error);
      notify('Google sign-in failed. Check Firebase configuration and console.');
    }
    return;
  }
  state.fallbackAuth = true;
  state.user = { uid: 'local-demo-user', displayName: 'LinuxAid Learner' };
  localStorage.setItem('linuxaid-auth', 'true');
  renderAuthState();
  elements.authOverlay?.classList.remove('active');
  notify('Preview sign-in enabled. Firebase not configured.');
}

async function handleEmailSignIn() {
  const email = elements.authEmail?.value.trim();
  const password = elements.authPassword?.value.trim();
  if (!email || !password) {
    return notify('Fill both email and password to continue.');
  }

  if (config.firebase?.apiKey) {
    try {
      const user = await signInWithEmailClient(email, password);
      state.user = user;
      renderAuthState();
      loadRemoteChatHistory(user.uid);
      elements.authOverlay?.classList.remove('active');
      notify(`Welcome back, ${email.split('@')[0] || 'learner'}!`);
    } catch (error) {
      console.error(error);
      notify('Email sign-in failed. Check your credentials and Firebase settings.');
    }
    return;
  }

  state.fallbackAuth = true;
  state.user = { uid: 'local-demo-user', displayName: email.split('@')[0] || 'LinuxAid learner' };
  localStorage.setItem('linuxaid-auth', 'true');
  renderAuthState();
  elements.authOverlay?.classList.remove('active');
  notify(`Signed in locally as ${state.user.displayName}.`);
}

async function handleLogout() {
  if (config.firebase?.apiKey && state.user && !state.fallbackAuth) {
    try {
      await signOutClient();
    } catch (error) {
      console.error(error);
    }
  }
  state.user = null;
  state.fallbackAuth = false;
  localStorage.setItem('linuxaid-auth', 'false');
  renderAuthState();
  notify('You have been signed out.');
}

function loadInitialChat() {
  const storedChat = localStorage.getItem('linuxaid-chat');
  state.chatHistory = storedChat ? JSON.parse(storedChat) : [
    { role:'assistant', text:'Welcome to LinuxAid. Ask me about safe Linux commands or how to start with your first terminal session.' }
  ];
  renderChat();
}

async function loadRemoteChatHistory(uid) {
  if (!uid || !config.firebase?.apiKey) return;
  const messages = await loadUserChatHistory(uid);
  if (messages.length > 0) {
    state.chatHistory = messages;
  }
  renderChat();
}

function renderSuggestions() {
  if (!elements.suggestionBar) return;
  elements.suggestionBar.innerHTML = '';
  state.suggestedPrompts.forEach(prompt => {
    const pill = document.createElement('button');
    pill.className = 'suggestion-pill';
    pill.type = 'button';
    pill.textContent = prompt;
    pill.onclick = () => {
      if (!elements.chatInput) return;
      elements.chatInput.value = prompt;
      handleChatSend();
    };
    elements.suggestionBar.appendChild(pill);
  });
}

function renderChat() {
  if (!elements.chatMessages) return;
  elements.chatMessages.innerHTML = '';
  state.chatHistory.forEach(item => {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${item.role}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.role === 'assistant' ? 'LinuxAid' : 'You';
    const content = document.createElement('div');
    content.innerHTML = parseMarkdown(item.text);
    messageEl.append(meta, content);
    elements.chatMessages.appendChild(messageEl);
  });
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function handleChatSend() {
  if (!elements.chatInput) return;
  const text = elements.chatInput.value.trim();
  if (!text) return;
  if (!state.user) {
    elements.authOverlay?.classList.add('active');
    return;
  }

  state.chatHistory.push({ role:'user', text });
  renderChat();
  elements.chatInput.value = '';
  await sendAIResponse(text);
}

async function sendAIResponse(text) {
  const responseNode = { role:'assistant', text:'LinuxAid is thinking...' };
  state.chatHistory.push(responseNode);
  renderChat();

  try {
    const answer = config.geminiApiKey ? await queryGemini(text, config) : generateLocalAIAnswer(text);
    responseNode.text = answer;
  } catch (error) {
    console.error(error);
    responseNode.text = `${generateLocalAIAnswer(text)}\n\nNote: AI service unavailable. Configure Gemini credentials in config.js or use the local fallback.`;
  }

  renderChat();
  saveChat();
}

function generateLocalAIAnswer(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chmod')) {
    return 'chmod changes file permissions. Use <code>chmod 755 file.sh</code> for safe executable access and avoid <code>chmod 777</code> on important files.';
  }
  if (lower.includes('sudo')) {
    return 'sudo runs a command with elevated privileges. It is powerful, so always verify commands before using sudo and never run destructive commands without understanding them.';
  }
  if (lower.includes('permission denied')) {
    return 'A permission denied error means you lack access rights. Try checking file ownership with <code>ls -l</code> and use <code>chmod</code> or safe <code>sudo</code> only when needed.';
  }
  if (lower.includes('install packages') || lower.includes('packages')) {
    return 'Install packages with your distro package manager such as <code>sudo apt install package</code> or <code>sudo dnf install package</code>. Always update first with <code>sudo apt update</code> or equivalent.';
  }
  if (lower.includes('help') || lower.includes('beginner')) {
    return 'Start with <code>pwd</code>, <code>ls</code>, <code>cd</code>, and <code>cat</code>. Practice those commands in the simulator and ask me anytime for examples.';
  }
  return 'LinuxAid suggests using <code>man</code> pages, safe command examples, and careful verification. Ask for command syntax, permissions, or specific tutorials for more details.';
}

function parseMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function saveChat() {
  if (config.firebase?.apiKey && state.user && !state.fallbackAuth) {
    saveUserChatHistory(state.user.uid, state.chatHistory);
  }
  localStorage.setItem('linuxaid-chat', JSON.stringify(state.chatHistory));
}

function renderCommands() {
  if (!elements.commandGrid) return;
  const query = elements.commandSearch?.value.toLowerCase() || '';
  const category = elements.commandCategory?.value || 'all';
  elements.commandGrid.innerHTML = '';

  state.commandDocs.filter(cmd => {
    const matchesQuery = !query || cmd.name.includes(query) || cmd.explanation.toLowerCase().includes(query) || cmd.syntax.toLowerCase().includes(query);
    const matchesCategory = category === 'all' || cmd.category === category;
    return matchesQuery && matchesCategory;
  }).forEach(cmd => {
    const card = document.createElement('div');
    card.className = 'command-card glass';
    const header = document.createElement('div');
    header.className = 'command-header';
    const title = document.createElement('h4');
    title.textContent = cmd.name;
    const tag = document.createElement('span');
    tag.className = `badge ${cmd.safety}`;
    tag.textContent = cmd.safety;
    header.append(title, tag);

    const syntax = document.createElement('div');
    syntax.className = 'syntax';
    syntax.textContent = cmd.syntax;
    const body = document.createElement('p');
    body.textContent = cmd.explanation;
    const list = document.createElement('ul');
    cmd.examples.forEach(example => {
      const li = document.createElement('li');
      li.textContent = example;
      list.appendChild(li);
    });
    const related = document.createElement('p');
    related.innerHTML = '<strong>Related:</strong> ' + cmd.related.join(', ');
    const warning = document.createElement('p');
    warning.style.color = '#ff8a8a';
    warning.style.fontWeight = '600';
    warning.textContent = cmd.warning;
    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';
    const copyButton = document.createElement('button');
    copyButton.className = 'button';
    copyButton.type = 'button';
    copyButton.textContent = 'Copy syntax';
    copyButton.onclick = () => copyText(cmd.syntax);
    actionRow.append(copyButton);
    card.append(header, syntax, body, list, related, warning, actionRow);
    elements.commandGrid.appendChild(card);
  });
}

function resetFilters() {
  if (!elements.commandSearch || !elements.commandCategory) return;
  elements.commandSearch.value = '';
  elements.commandCategory.value = 'all';
  renderCommands();
}

function copyText(value) {
  navigator.clipboard?.writeText(value).then(() => notify('Copied to clipboard'), () => notify('Copy failed'));
}

function handleTerminalCommand() {
  if (!elements.terminalInput) return;
  const raw = elements.terminalInput.value.trim();
  if (!raw) return;
  const output = executeTerminalCommand(raw);
  renderTerminalOutput(`<span style="color:var(--green);">$ ${escapeHtml(raw)}</span>\n${escapeHtml(output)}`);
  elements.terminalInput.value = '';
}

function executeTerminalCommand(raw) {
  const [cmd, ...args] = raw.split(/\s+/);
  const cwd = state.terminal.cwd;
  const fileSystem = state.terminal.fileSystem;
  const currentFiles = fileSystem[cwd] || [];

  if (cmd === 'help') {
    return 'Supported commands: ls, cd, pwd, mkdir, rm, cp, mv, touch, clear, cat, echo.';
  }
  if (cmd === 'pwd') return cwd;
  if (cmd === 'ls') return currentFiles.join('  ') || 'Empty directory';
  if (cmd === 'cd') {
    const target = args[0] || '/home/linuxaid';
    const newPath = normalizePath(cwd, target);
    if (fileSystem[newPath]) {
      state.terminal.cwd = newPath;
      return `Changed directory to ${newPath}`;
    }
    return `bash: cd: ${target}: No such file or directory`;
  }
  if (cmd === 'mkdir') {
    const dir = args[0];
    if (!dir) return 'mkdir: missing operand';
    const newDir = normalizePath(cwd, dir);
    if (fileSystem[newDir]) return `mkdir: cannot create directory ‘${dir}’: File exists`;
    fileSystem[newDir] = [];
    if (!currentFiles.includes(dir)) currentFiles.push(dir);
    return `Created ${newDir}`;
  }
  if (cmd === 'touch') {
    const file = args[0];
    if (!file) return 'touch: missing file operand';
    if (!currentFiles.includes(file)) currentFiles.push(file);
    return `Updated timestamp on ${file}`;
  }
  if (cmd === 'cat') {
    const file = args[0];
    if (!file) return 'cat: missing file operand';
    if (currentFiles.includes(file)) return `# ${file}\nThis is a simulated file content. Use it to learn safely.`;
    return `cat: ${file}: No such file or directory`;
  }
  if (cmd === 'echo') return args.join(' ');
  if (cmd === 'clear') {
    elements.terminalOutput.innerHTML = '';
    return '';
  }
  if (cmd === 'rm') {
    const target = args[0];
    if (!target) return 'rm: missing operand';
    if (target === '-rf' || raw.includes('rm -rf')) {
      return 'Danger: rm -rf is blocked in this simulator. Use safer alternatives.';
    }
    const index = currentFiles.indexOf(target);
    if (index !== -1) {
      currentFiles.splice(index, 1);
      return `${target} removed`;
    }
    return `rm: cannot remove '${target}': No such file or directory`;
  }
  if (cmd === 'cp' || cmd === 'mv') {
    return `${cmd}: simulated command. This interface shows safe examples only.`;
  }
  return `${cmd}: command not found. Type help for supported commands.`;
}

function normalizePath(cwd, target) {
  if (target.startsWith('/')) return target.replace(/\/\/+/, '/');
  if (target === '..') {
    const parent = cwd.substring(0, cwd.lastIndexOf('/')) || '/';
    return parent === '' ? '/' : parent;
  }
  if (target === '.') return cwd;
  return `${cwd}/${target}`.replace(/\/\/+/, '/');
}

function renderTerminalOutput(html) {
  if (!elements.terminalOutput) return;
  const row = document.createElement('div');
  row.innerHTML = html;
  elements.terminalOutput.appendChild(row);
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function notify(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '14px 18px';
  toast.style.borderRadius = '16px';
  toast.style.background = 'rgba(3, 6, 12, 0.96)';
  toast.style.color = '#d6f7cd';
  toast.style.border = '1px solid rgba(101,255,141,0.18)';
  toast.style.boxShadow = '0 18px 50px rgba(0,0,0,0.32)';
  toast.style.zIndex = 9999;
  toast.style.opacity = '1';
  toast.style.transition = 'opacity 0.35s ease';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 450);
  }, 2200);
}

function animateLoading() {
  if (!elements.loadingBar) {
    removeLoadingScreen();
    return;
  }
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    elements.loadingBar.style.width = `${Math.min(progress, 100)}%`;
    if (progress >= 100) {
      clearInterval(interval);
      removeLoadingScreen();
    }
  }, 120);
  setTimeout(() => {
    clearInterval(interval);
    removeLoadingScreen();
  }, 6000);
}

async function loadCommunityPostsIfAvailable() {
  try {
    const posts = await loadCommunityPosts();
    if (!posts.length) return;
    const communityGrid = document.querySelector('.community-grid');
    if (!communityGrid) return;
    communityGrid.innerHTML = '';
    posts.slice(0, 3).forEach(post => {
      const card = document.createElement('div');
      card.className = 'community-card glass';
      card.innerHTML = `<h3>${escapeHtml(post.title || 'Community post')}</h3>
        <div class="meta">${escapeHtml(post.meta || 'Latest discussion')}</div>
        <p>${escapeHtml(post.body || 'No content')}</p>
        <div class="community-actions">
          <span class="community-pill">${post.replies || 0} replies</span>
          <span class="community-pill">upvotes ${post.upvotes || 0}</span>
        </div>`;
      communityGrid.appendChild(card);
    });
  } catch (error) {
    console.warn('Unable to load community posts:', error);
  }
}

window.addEventListener('error', () => removeLoadingScreen());
window.addEventListener('unhandledrejection', () => removeLoadingScreen());

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { renderCommands, resetFilters };
