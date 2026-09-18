import { createTerminalEngine } from './terminalEngineV8.js';
import { recordCommandUsage } from './progress.js';

const excludedPages = new Set(['auth','privacy','terms','cookies','security']);
if (!excludedPages.has(document.body.dataset.page || '')) {
  const engine = createTerminalEngine();
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'terminal-fab';
  fab.id = 'terminalFab';
  fab.setAttribute('aria-label','Open LinuxAid floating terminal');
  fab.innerHTML = '<i class="fas fa-terminal" aria-hidden="true"></i><span>Terminal</span><kbd>Alt T</kbd>';

  const backdrop = document.createElement('div');
  backdrop.className = 'terminal-dock-backdrop';
  backdrop.id = 'terminalDockBackdrop';
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden','true');
  backdrop.innerHTML = `
    <section class="terminal-dock" role="dialog" aria-modal="true" aria-label="LinuxAid Terminal Lab">
      <header class="terminal-dock-head">
        <div class="terminal-dock-title"><span></span><i class="fas fa-terminal" aria-hidden="true"></i><span>LinuxAid Terminal V8</span></div>
        <div class="terminal-dock-actions">
          <button type="button" data-terminal-doctor aria-label="Run terminal doctor"><i class="fas fa-stethoscope"></i></button>
          <button type="button" data-terminal-commands aria-label="Show command reference"><i class="fas fa-book"></i></button>
          <button type="button" data-terminal-clear aria-label="Clear terminal"><i class="fas fa-eraser"></i></button>
          <button type="button" data-terminal-close aria-label="Close terminal"><i class="fas fa-xmark"></i></button>
        </div>
      </header>
      <div class="terminal-dock-status" id="terminalDockStatus">Safe simulator + ${engine.referenceCount.toLocaleString()} indexed command forms • Try <strong>doctor</strong>, <strong>debug</strong>, <strong>commands</strong> or <strong>man ls</strong>.</div>
      <div class="terminal-dock-output" id="terminalDockOutput" aria-live="polite"></div>
      <form class="terminal-dock-input-row" id="terminalDockForm">
        <span id="terminalDockPrompt">linuxaid@simulator:~$</span>
        <input class="terminal-dock-input" id="terminalDockInput" autocomplete="off" spellcheck="false" placeholder="Type a Linux command…" aria-label="Linux terminal command">
        <button class="terminal-dock-send" type="submit">Run</button>
      </form>
    </section>`;

  document.body.append(fab, backdrop);
  const output = backdrop.querySelector('#terminalDockOutput');
  const input = backdrop.querySelector('#terminalDockInput');
  const prompt = backdrop.querySelector('#terminalDockPrompt');
  const status = backdrop.querySelector('#terminalDockStatus');
  const form = backdrop.querySelector('#terminalDockForm');
  let lastFocus = null;

  function append(command, result) {
    const line = document.createElement('div');
    line.className = 'terminal-dock-line';
    const shell = document.createElement('div');
    shell.innerHTML = `<span class="terminal-dock-prompt"></span>`;
    shell.querySelector('span').textContent = `linuxaid@${engine.state.host}:${engine.state.cwd}$ ${command}`;
    line.appendChild(shell);
    if (result.output) {
      const text = document.createElement('div');
      text.textContent = result.output;
      if (result.blocked || result.safety?.level === 'extreme') text.className = 'terminal-dock-error';
      line.appendChild(text);
    }
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function welcome() {
    if (output.childElementCount) return;
    const intro = document.createElement('div');
    intro.className = 'terminal-dock-line';
    intro.textContent = `LinuxAid Terminal V8 ready. Core commands are safely simulated and ${engine.referenceCount.toLocaleString()} command forms are indexed. Try: pwd, ls -la, doctor, commands docker, explain chmod, or debug permission denied.`;
    output.appendChild(intro);
  }

  function updatePrompt() {
    prompt.textContent = `linuxaid@${engine.state.host}:${engine.state.cwd}$`;
  }

  function run(raw) {
    const command = String(raw || '').trim();
    if (!command) return;
    const result = engine.execute(command);
    if (result.clear) output.replaceChildren();
    else append(command, result);
    if (result.command && !result.blocked) {
      recordCommandUsage(result.command);
      document.dispatchEvent(new CustomEvent('linuxaid:command-run', { detail:{ command:result.command, safety:result.safety?.level || 'safe', source:'floating-terminal' } }));
    }
    status.textContent = `${String(result.safety?.level || 'safe').toUpperCase()} • ${result.safety?.reason || 'Simulated safely inside LinuxAid.'}`;
    updatePrompt();
  }

  function open(prefill='') {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    backdrop.setAttribute('aria-hidden','false');
    backdrop.classList.add('open');
    document.documentElement.classList.add('terminal-open');
    document.body.style.overflow = 'hidden';
    welcome();
    if (prefill) input.value = prefill;
    setTimeout(() => input.focus(), 60);
  }

  function close() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden','true');
    backdrop.hidden = true;
    document.documentElement.classList.remove('terminal-open');
    document.body.style.overflow = '';
    if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll:true });
  }

  fab.addEventListener('click', () => open());
  backdrop.querySelector('[data-terminal-close]').addEventListener('click', close);
  backdrop.querySelector('[data-terminal-clear]').addEventListener('click', () => {
    output.replaceChildren();
    status.textContent = 'Terminal cleared • Your simulated filesystem is still available.';
    input.focus();
  });
  backdrop.querySelector('[data-terminal-doctor]').addEventListener('click', () => { run('doctor'); input.focus(); });
  backdrop.querySelector('[data-terminal-commands]').addEventListener('click', () => { run('commands'); input.focus(); });
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(input.value);
    input.value = '';
    input.focus();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp') { event.preventDefault(); input.value = engine.historyMove(-1); }
    if (event.key === 'ArrowDown') { event.preventDefault(); input.value = engine.historyMove(1); }
    if (event.key === 'Tab') { event.preventDefault(); input.value = engine.autocomplete(input.value); }
  });
  document.addEventListener('keydown', event => {
    if (event.altKey && event.key.toLowerCase() === 't') { event.preventDefault(); backdrop.classList.contains('open') ? close() : open(); }
    if (event.key === 'Escape' && backdrop.classList.contains('open')) close();
  });
  document.addEventListener('linuxaid:open-terminal', event => open(event.detail?.command || ''));
  updatePrompt();
}
