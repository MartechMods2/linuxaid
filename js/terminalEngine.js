import { commandNames, getCommand } from './commandCatalog.js';

const clone = value => JSON.parse(JSON.stringify(value));

const BASE_FS = {
  '/': { type:'dir', mode:'755', owner:'root', group:'root' },
  '/home': { type:'dir', mode:'755', owner:'root', group:'root' },
  '/home/linuxaid': { type:'dir', mode:'755', owner:'linuxaid', group:'linuxaid' },
  '/home/linuxaid/projects': { type:'dir', mode:'755', owner:'linuxaid', group:'linuxaid' },
  '/home/linuxaid/README.md': { type:'file', mode:'644', owner:'linuxaid', group:'linuxaid', content:'Welcome to LinuxAid. Practice safely, inspect before changing, and use man <command> when unsure.\n' },
  '/home/linuxaid/notes.txt': { type:'file', mode:'644', owner:'linuxaid', group:'linuxaid', content:'LinuxAid terminal lab notes\n- pwd shows where you are\n- ls lists files\n- chmod changes permissions\n' },
  '/home/linuxaid/projects/starter.sh': { type:'file', mode:'755', owner:'linuxaid', group:'linuxaid', content:'#!/usr/bin/env bash\necho "Hello from LinuxAid"\n' },
  '/home/linuxaid/projects/learn-linux.txt': { type:'file', mode:'644', owner:'linuxaid', group:'linuxaid', content:'Practice: pwd, ls -la, cd, cat, grep, find, chmod and history.\n' },
  '/tmp': { type:'dir', mode:'1777', owner:'root', group:'root' },
  '/etc': { type:'dir', mode:'755', owner:'root', group:'root' },
  '/etc/hosts': { type:'file', mode:'644', owner:'root', group:'root', content:'127.0.0.1 localhost\n127.0.1.1 linuxaid\n' },
  '/var': { type:'dir', mode:'755', owner:'root', group:'root' },
  '/var/log': { type:'dir', mode:'755', owner:'root', group:'root' },
  '/var/log/syslog': { type:'file', mode:'640', owner:'root', group:'adm', content:'Sep 16 08:00:00 linuxaid systemd[1]: Started LinuxAid learning session.\nSep 16 08:02:15 linuxaid sshd[811]: Listening on port 22.\n' }
};

function tokenize(input) {
  const tokens = [];
  String(input || '').replace(/"([^"]*)"|'([^']*)'|([^\s]+)/g, (_match, dbl, single, bare) => {
    tokens.push(dbl ?? single ?? bare);
    return '';
  });
  return tokens;
}

function compactPath(path) {
  const parts = [];
  for (const part of String(path || '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}` || '/';
}

export function resolvePath(cwd, target = '.') {
  const raw = String(target || '.').replace(/^~/, '/home/linuxaid');
  return compactPath(raw.startsWith('/') ? raw : `${cwd}/${raw}`);
}

function parentPath(path) {
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}` || '/';
}

function baseName(path) {
  return path.split('/').filter(Boolean).at(-1) || '/';
}

function childrenOf(nodes, path) {
  const prefix = path === '/' ? '/' : `${path}/`;
  return Object.keys(nodes)
    .filter(candidate => candidate !== path && candidate.startsWith(prefix))
    .filter(candidate => !candidate.slice(prefix.length).includes('/'))
    .sort();
}

function modeDisplay(node) {
  const map = { '0':'---','1':'--x','2':'-w-','3':'-wx','4':'r--','5':'r-x','6':'rw-','7':'rwx' };
  const mode = String(node.mode || '644').slice(-3).padStart(3, '0');
  return `${node.type === 'dir' ? 'd' : '-'}${[...mode].map(n => map[n] || '---').join('')}`;
}

export function analyzeCommandSafety(raw) {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase();
  if (!value) return { level:'safe', reason:'No command entered.' };
  if (/rm\s+-[^\n]*r[^\n]*f[^\n]*(\/\s*$|\/\*|--no-preserve-root)/i.test(value) || /:\(\)\s*\{\s*:\|:&\s*;\s*\}\s*;\s*:/i.test(value) || /\bmkfs\b|\bdd\s+if=|>\s*\/dev\/sd[a-z]/i.test(value)) {
    return { level:'extreme', reason:'This pattern can destroy filesystems or large amounts of data on a real Linux machine.' };
  }
  if (/\bsudo\b|\bchmod\s+777\b|\bchown\b|\bsystemctl\s+(stop|disable|mask|restart)|\bkill\s+-9\b/i.test(value)) {
    return { level:'high', reason:'This command can change privileged system state or interrupt services.' };
  }
  if (/\brm\b|\bmv\b|\bcp\b|\bcurl\b.*\|\s*(sh|bash)|\bwget\b.*\|\s*(sh|bash)/i.test(value)) {
    return { level:'medium', reason:'This command can overwrite, delete, move, or execute external content.' };
  }
  if (lower.startsWith('apt ') || lower.startsWith('dnf ') || lower.startsWith('pacman ')) {
    return { level:'medium', reason:'Package operations can change installed software on a real machine.' };
  }
  return { level:'safe', reason:'This is read-only or safely simulated in LinuxAid.' };
}

export function createTerminalEngine(initial = {}) {
  const state = {
    cwd: '/home/linuxaid',
    user: 'linuxaid',
    host: 'simulator',
    history: [],
    historyIndex: 0,
    nodes: { ...clone(BASE_FS), ...(initial.nodes || {}) },
    ...initial
  };

  const exists = path => Boolean(state.nodes[path]);
  const isDir = path => state.nodes[path]?.type === 'dir';
  const isFile = path => state.nodes[path]?.type === 'file';

  function ensureParent(path) {
    const parent = parentPath(path);
    return exists(parent) && isDir(parent);
  }

  function makeDir(path, recursive = false) {
    if (exists(path)) return `mkdir: cannot create directory '${baseName(path)}': File exists`;
    const parent = parentPath(path);
    if (!exists(parent)) {
      if (!recursive) return `mkdir: cannot create directory '${baseName(path)}': No such file or directory`;
      const parentResult = makeDir(parent, true);
      if (parentResult && parentResult.startsWith('mkdir:')) return parentResult;
    }
    state.nodes[path] = { type:'dir', mode:'755', owner:state.user, group:state.user };
    return '';
  }

  function removePath(path, recursive = false) {
    if (!exists(path)) return `rm: cannot remove '${baseName(path)}': No such file or directory`;
    if (path === '/' || path === '/home' || path === '/home/linuxaid') return 'LinuxAid safety: protected simulator path cannot be removed.';
    if (isDir(path)) {
      const children = childrenOf(state.nodes, path);
      if (children.length && !recursive) return `rm: cannot remove '${baseName(path)}': Is a directory`;
      Object.keys(state.nodes).filter(candidate => candidate === path || candidate.startsWith(`${path}/`)).forEach(candidate => delete state.nodes[candidate]);
    } else {
      delete state.nodes[path];
    }
    return '';
  }

  function list(path, long = false, all = false) {
    if (!exists(path)) return `ls: cannot access '${path}': No such file or directory`;
    if (isFile(path)) return long ? `${modeDisplay(state.nodes[path])} 1 ${state.nodes[path].owner} ${state.nodes[path].group} ${String(state.nodes[path].content || '').length} ${baseName(path)}` : baseName(path);
    const items = childrenOf(state.nodes, path).filter(item => all || !baseName(item).startsWith('.'));
    if (!long) return items.map(baseName).join('  ') || 'Empty directory';
    return items.map(item => {
      const node = state.nodes[item];
      const size = node.type === 'file' ? String(node.content || '').length : childrenOf(state.nodes, item).length;
      return `${modeDisplay(node)} 1 ${node.owner} ${node.group} ${size} ${baseName(item)}`;
    }).join('\n') || 'Empty directory';
  }

  function copyNode(source, destination, recursive = false) {
    if (!exists(source)) return `cp: cannot stat '${baseName(source)}': No such file or directory`;
    if (isDir(source) && !recursive) return `cp: -r not specified; omitting directory '${baseName(source)}'`;
    let dest = destination;
    if (isDir(destination)) dest = resolvePath(destination, baseName(source));
    if (!ensureParent(dest)) return `cp: cannot create '${dest}': No such directory`;
    if (isFile(source)) {
      state.nodes[dest] = clone(state.nodes[source]);
      return '';
    }
    const prefix = `${source}/`;
    Object.keys(state.nodes).filter(path => path === source || path.startsWith(prefix)).forEach(path => {
      const suffix = path.slice(source.length);
      state.nodes[`${dest}${suffix}`] = clone(state.nodes[path]);
    });
    return '';
  }

  function moveNode(source, destination) {
    if (!exists(source)) return `mv: cannot stat '${baseName(source)}': No such file or directory`;
    let dest = destination;
    if (isDir(destination)) dest = resolvePath(destination, baseName(source));
    if (!ensureParent(dest)) return `mv: cannot move to '${dest}': No such directory`;
    const entries = Object.keys(state.nodes).filter(path => path === source || path.startsWith(`${source}/`));
    for (const path of entries) {
      const suffix = path.slice(source.length);
      state.nodes[`${dest}${suffix}`] = clone(state.nodes[path]);
    }
    entries.sort((a,b) => b.length - a.length).forEach(path => delete state.nodes[path]);
    return '';
  }

  function execute(raw) {
    const input = String(raw || '').trim();
    if (!input) return { output:'', command:'', safety:analyzeCommandSafety(input) };
    state.history.push(input);
    state.history = state.history.slice(-100);
    state.historyIndex = state.history.length;

    const safety = analyzeCommandSafety(input);
    if (safety.level === 'extreme') {
      return { output:`BLOCKED: ${safety.reason}\nLinuxAid does not simulate destructive filesystem commands.`, command:tokenize(input)[0] || '', safety, blocked:true };
    }

    const tokens = tokenize(input);
    const cmd = (tokens.shift() || '').toLowerCase();
    const args = tokens;
    let output = '';
    let clear = false;

    switch (cmd) {
      case 'help':
        output = `LinuxAid Terminal V2\nSupported: ${commandNames().join(', ')}\nTip: use man <command>, Arrow Up/Down for history, and Tab for autocomplete.`;
        break;
      case 'pwd': output = state.cwd; break;
      case 'whoami': output = state.user; break;
      case 'id': output = `uid=1000(${state.user}) gid=1000(${state.user}) groups=1000(${state.user}),27(sudo)`; break;
      case 'hostname': output = state.host; break;
      case 'uname': output = args.includes('-a') ? 'Linux linuxaid 6.8.0-linuxaid #1 SMP x86_64 GNU/Linux' : args.includes('-r') ? '6.8.0-linuxaid' : 'Linux'; break;
      case 'date': output = new Date().toString(); break;
      case 'which': {
        const name = args[0];
        output = name && commandNames().includes(name) ? `/usr/bin/${name}` : `${name || ''} not found`;
        break;
      }
      case 'history': output = state.history.map((entry,index) => `${index + 1}\t${entry}`).join('\n'); break;
      case 'clear': clear = true; output = ''; break;
      case 'ls': {
        const long = args.some(arg => arg.startsWith('-') && arg.includes('l'));
        const all = args.some(arg => arg.startsWith('-') && arg.includes('a'));
        const target = args.find(arg => !arg.startsWith('-')) || '.';
        output = list(resolvePath(state.cwd, target), long, all);
        break;
      }
      case 'cd': {
        const path = resolvePath(state.cwd, args[0] || '~');
        if (!exists(path)) output = `bash: cd: ${args[0] || '~'}: No such file or directory`;
        else if (!isDir(path)) output = `bash: cd: ${args[0]}: Not a directory`;
        else { state.cwd = path; output = ''; }
        break;
      }
      case 'mkdir': {
        const recursive = args.includes('-p');
        const targets = args.filter(arg => !arg.startsWith('-'));
        if (!targets.length) output = 'mkdir: missing operand';
        else output = targets.map(target => makeDir(resolvePath(state.cwd, target), recursive)).filter(Boolean).join('\n');
        break;
      }
      case 'touch': {
        if (!args.length) { output = 'touch: missing file operand'; break; }
        for (const item of args) {
          const path = resolvePath(state.cwd, item);
          if (!ensureParent(path)) { output += `touch: cannot touch '${item}': No such file or directory\n`; continue; }
          if (!exists(path)) state.nodes[path] = { type:'file', mode:'644', owner:state.user, group:state.user, content:'' };
        }
        output = output.trim();
        break;
      }
      case 'cat': {
        if (!args.length) output = 'cat: missing file operand';
        else output = args.map(item => {
          const path = resolvePath(state.cwd, item);
          return !exists(path) ? `cat: ${item}: No such file or directory` : isDir(path) ? `cat: ${item}: Is a directory` : state.nodes[path].content || '';
        }).join('\n');
        break;
      }
      case 'head':
      case 'tail': {
        let count = 10;
        const nIndex = args.indexOf('-n');
        if (nIndex >= 0) count = Math.max(1, Number.parseInt(args[nIndex + 1],10) || 10);
        const file = args.filter((arg,index) => arg !== '-n' && index !== nIndex + 1).at(-1);
        if (!file) { output = `${cmd}: missing file operand`; break; }
        const path = resolvePath(state.cwd, file);
        if (!isFile(path)) { output = `${cmd}: cannot open '${file}'`; break; }
        const lines = String(state.nodes[path].content || '').split('\n');
        output = (cmd === 'head' ? lines.slice(0,count) : lines.slice(-count)).join('\n');
        break;
      }
      case 'echo':
      case 'printf': {
        const redirectIndex = args.findIndex(arg => arg === '>' || arg === '>>');
        if (redirectIndex >= 0) {
          const append = args[redirectIndex] === '>>';
          const target = args[redirectIndex + 1];
          if (!target) { output = 'bash: syntax error near unexpected token newline'; break; }
          const path = resolvePath(state.cwd, target);
          const text = args.slice(0, redirectIndex).join(' ');
          if (!ensureParent(path)) { output = `bash: ${target}: No such file or directory`; break; }
          const existing = isFile(path) ? state.nodes[path].content : '';
          state.nodes[path] = { type:'file', mode:state.nodes[path]?.mode || '644', owner:state.user, group:state.user, content:append ? `${existing}${text}\n` : `${text}\n` };
          output = '';
        } else output = args.join(' ');
        break;
      }
      case 'cp': {
        const recursive = args.includes('-r') || args.includes('-R');
        const paths = args.filter(arg => !arg.startsWith('-'));
        if (paths.length < 2) output = 'cp: missing destination file operand';
        else output = copyNode(resolvePath(state.cwd, paths[0]), resolvePath(state.cwd, paths[1]), recursive);
        break;
      }
      case 'mv': {
        if (args.length < 2) output = 'mv: missing destination file operand';
        else output = moveNode(resolvePath(state.cwd, args[0]), resolvePath(state.cwd, args[1]));
        break;
      }
      case 'rm': {
        const recursive = args.some(arg => arg.startsWith('-') && arg.includes('r'));
        const targets = args.filter(arg => !arg.startsWith('-'));
        if (!targets.length) output = 'rm: missing operand';
        else output = targets.map(target => removePath(resolvePath(state.cwd, target), recursive)).filter(Boolean).join('\n');
        break;
      }
      case 'grep': {
        const insensitive = args.includes('-i');
        const cleanArgs = args.filter(arg => arg !== '-i');
        const [pattern, file] = cleanArgs;
        if (!pattern || !file) { output = 'grep: use grep [-i] pattern file'; break; }
        const path = resolvePath(state.cwd, file);
        if (!isFile(path)) { output = `grep: ${file}: No such file`; break; }
        const needle = insensitive ? pattern.toLowerCase() : pattern;
        output = String(state.nodes[path].content || '').split('\n').filter(line => (insensitive ? line.toLowerCase() : line).includes(needle)).join('\n');
        break;
      }
      case 'find': {
        const start = resolvePath(state.cwd, args[0] && !args[0].startsWith('-') ? args[0] : '.');
        const nameIndex = args.indexOf('-name');
        const pattern = nameIndex >= 0 ? args[nameIndex + 1] : null;
        if (!exists(start)) { output = `find: '${args[0]}': No such file or directory`; break; }
        const regex = pattern ? new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')}$`) : null;
        output = Object.keys(state.nodes).filter(path => path === start || path.startsWith(`${start}/`)).filter(path => !regex || regex.test(baseName(path))).join('\n');
        break;
      }
      case 'chmod': {
        const [mode, target] = args;
        if (!mode || !target) { output = 'chmod: use chmod <mode> <file>'; break; }
        const path = resolvePath(state.cwd, target);
        if (!exists(path)) { output = `chmod: cannot access '${target}': No such file or directory`; break; }
        if (/^[0-7]{3,4}$/.test(mode)) state.nodes[path].mode = mode;
        else if (mode === '+x') {
          const current = String(state.nodes[path].mode || '644').slice(-3).split('').map(Number);
          state.nodes[path].mode = current.map(n => n | 1).join('');
        } else output = 'chmod: simulator currently supports numeric modes or +x';
        break;
      }
      case 'stat': {
        const path = resolvePath(state.cwd, args[0] || '.');
        if (!exists(path)) output = `stat: cannot stat '${args[0]}': No such file or directory`;
        else {
          const node = state.nodes[path];
          output = `File: ${path}\nType: ${node.type}\nAccess: (${node.mode}) ${modeDisplay(node)}\nOwner: ${node.owner}\nGroup: ${node.group}\nSize: ${node.type === 'file' ? String(node.content || '').length : childrenOf(state.nodes,path).length}`;
        }
        break;
      }
      case 'du': {
        const path = resolvePath(state.cwd, args.find(arg => !arg.startsWith('-')) || '.');
        const size = Object.entries(state.nodes).filter(([candidate]) => candidate === path || candidate.startsWith(`${path}/`)).reduce((total,[,node]) => total + (node.type === 'file' ? String(node.content || '').length : 4096),0);
        output = `${Math.max(4, Math.ceil(size/1024))}K\t${path}`;
        break;
      }
      case 'df': output = 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/simdisk     20G  4.2G   15G  23% /'; break;
      case 'free': output = '               total        used        free      shared  buff/cache   available\nMem:           7.7Gi       2.1Gi       3.9Gi       210Mi       1.7Gi       5.2Gi\nSwap:          2.0Gi          0B       2.0Gi'; break;
      case 'ps': output = 'PID TTY          TIME CMD\n811 ?        00:00:01 sshd\n1042 pts/0    00:00:00 bash\n1188 pts/0    00:00:00 ps'; break;
      case 'top': output = 'LinuxAid simulation: load average 0.18, 0.11, 0.08 | Tasks 42 | CPU 4.2% | Memory 27%'; break;
      case 'ping': output = args[0] ? `PING ${args.at(-1)}: 56 data bytes\n64 bytes from 203.0.113.10: icmp_seq=1 ttl=56 time=18.4 ms\n--- ${args.at(-1)} ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss` : 'ping: usage error: Destination address required'; break;
      case 'ip': output = args.includes('route') ? 'default via 192.0.2.1 dev eth0\n192.0.2.0/24 dev eth0 proto kernel scope link src 192.0.2.25' : '1: lo: <LOOPBACK,UP> mtu 65536\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 192.0.2.25/24 scope global eth0'; break;
      case 'ss': output = 'Netid State  Local Address:Port   Peer Address:Port\ntcp   LISTEN 0.0.0.0:22           0.0.0.0:*\ntcp   LISTEN 127.0.0.1:3000       0.0.0.0:*'; break;
      case 'apt':
      case 'dnf':
      case 'pacman': output = `LinuxAid package simulation (${cmd}): no real packages are changed.\nRequested: ${args.join(' ') || 'no operation'}`; break;
      case 'systemctl': output = args[0] === 'status' ? `● ${args[1] || 'demo.service'} - LinuxAid simulated service\n   Loaded: loaded\n   Active: active (running)` : `LinuxAid simulation: systemctl ${args.join(' ')} acknowledged; no real service was changed.`; break;
      case 'journalctl': output = state.nodes['/var/log/syslog'].content; break;
      case 'man': {
        const name = args[0];
        const entry = getCommand(name);
        output = entry ? `${entry.name.toUpperCase()}(1)\n\nNAME\n    ${entry.name} - ${entry.explanation}\n\nSYNOPSIS\n    ${entry.syntax}\n\nEXAMPLES\n    ${entry.examples.join('\n    ')}\n\nSAFETY\n    ${entry.warning}` : `No manual entry for ${name || ''}`;
        break;
      }
      default: output = `${cmd}: command not found. Type help or use the Command Explorer.`;
    }

    return { output, clear, command:cmd, safety, cwd:state.cwd };
  }

  function historyMove(direction) {
    if (!state.history.length) return '';
    state.historyIndex = Math.min(state.history.length, Math.max(0, state.historyIndex + direction));
    return state.history[state.historyIndex] || '';
  }

  function autocomplete(input) {
    const value = String(input || '');
    const tokens = value.trimStart().split(/\s+/);
    if (tokens.length !== 1) return value;
    const matches = commandNames().filter(name => name.startsWith(tokens[0]));
    return matches.length === 1 ? matches[0] : value;
  }

  return { state, execute, historyMove, autocomplete, resolvePath:(target) => resolvePath(state.cwd,target), analyze:analyzeCommandSafety };
}
