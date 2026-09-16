const PACKAGE_MANAGERS = {
  ubuntu:'apt', debian:'apt', mint:'apt', kali:'apt', fedora:'dnf', rhel:'dnf', centos:'dnf', rocky:'dnf', alma:'dnf', arch:'pacman', manjaro:'pacman'
};

const ERROR_RULES = [
  { test:/permission denied/i, title:'Permission denied', cause:'Your current user does not have the required permission on the file, directory or socket.', checks:['ls -l <path>','id','namei -l <path>'], fix:'Inspect ownership and permission bits first. If it is your file and execute permission is missing, `chmod +x <file>` may be enough. Avoid using sudo as the first response.' },
  { test:/command not found/i, title:'Command not found', cause:'The program may not be installed, may not be in PATH, or the command name may be misspelled.', checks:['echo $PATH','which <command>','type <command>'], fix:'Confirm the command name, then install the correct package for your distro only if the program is genuinely missing.' },
  { test:/no space left on device/i, title:'No space left on device', cause:'The target filesystem may be full, or the filesystem may have exhausted inodes.', checks:['df -h','df -i','du -sh *'], fix:'Identify where space or inodes are being consumed before deleting anything. Clear known caches/logs or move data only after inspection.' },
  { test:/address already in use/i, title:'Address already in use', cause:'Another process is already listening on the requested IP address and port.', checks:['ss -tulpn','lsof -i :<port>'], fix:'Identify the process using the port. Stop/reconfigure the correct service or choose another port instead of killing random processes.' },
  { test:/connection refused/i, title:'Connection refused', cause:'The destination host is reachable but nothing is accepting the connection on that port, or a firewall/service policy is rejecting it.', checks:['ss -tulpn','systemctl status <service>','ip route'], fix:'Verify the service is running and listening on the expected address/port before changing firewall rules.' },
  { test:/temporary failure in name resolution|could not resolve host|name or service not known/i, title:'DNS resolution failure', cause:'The system could not translate a hostname into an IP address.', checks:['ping -c 2 1.1.1.1','cat /etc/resolv.conf','getent hosts example.com'], fix:'First prove basic internet reachability using an IP. If that works, investigate DNS configuration rather than the network interface.' },
  { test:/unable to locate package|no match for argument|target not found/i, title:'Package not found', cause:'The package name may be wrong, repositories may be stale, or the package may not exist for this distro/repository.', checks:['cat /etc/os-release','apt update / dnf check-update','search the package manager'], fix:'Confirm your distro and exact package name, refresh repository metadata, then search before adding third-party repositories.' },
  { test:/read-only file system/i, title:'Read-only filesystem', cause:'The filesystem is mounted read-only, possibly intentionally or because the kernel detected storage problems.', checks:['mount','findmnt','dmesg | tail'], fix:'Do not force writes immediately. Inspect mount state and kernel/storage errors first.' }
];

export function analyzeLinuxCommand(input) {
  const command = String(input || '').trim();
  if (!command) return { level:'safe', title:'No command entered', summary:'Enter a Linux command to analyze it.', flags:[], suggestions:[] };
  const lower = command.toLowerCase();
  let level = 'safe';
  const flags = [];
  const suggestions = [];

  if (/rm\s+-[^\n]*r[^\n]*f[^\n]*(\/\s*$|\/\*|--no-preserve-root)|\bmkfs\b|\bdd\s+if=|>\s*\/dev\/sd[a-z]|:\(\)\s*\{/.test(lower)) {
    level = 'extreme';
    flags.push('Potential destructive filesystem operation');
    suggestions.push('Do not run this on a real machine until you fully understand the target and have a tested backup.');
  } else if (/\bsudo\b|\bchmod\s+777\b|\bchown\b|\bsystemctl\s+(stop|disable|mask|restart)|\bkill\s+-9\b/.test(lower)) {
    level = 'high';
    flags.push('Privileged or service/process-changing operation');
    suggestions.push('Inspect current state first and make the smallest possible change.');
  } else if (/\brm\b|\bmv\b|\bcp\b|\bcurl\b.*\|\s*(sh|bash)|\bwget\b.*\|\s*(sh|bash)|\bapt\s+(install|remove|upgrade)|\bdnf\s+(install|remove|upgrade)|\bpacman\s+-s/.test(lower)) {
    level = 'medium';
    flags.push('May modify files, packages or execute downloaded content');
    suggestions.push('Confirm paths, package names and source trust before continuing.');
  } else {
    suggestions.push('This looks read-only or low-risk, but always confirm paths and options on important systems.');
  }

  if (lower.includes('sudo')) flags.push('Requires elevated privileges');
  if (/\b(rm|mv|cp)\b/.test(lower)) flags.push('Touches filesystem content');
  if (/\b(curl|wget|ssh|ping)\b/.test(lower)) flags.push('Uses the network');
  if (/\|\s*(sh|bash)\b/.test(lower)) flags.push('Pipes remote/local text directly into a shell');
  if (/chmod\s+777/.test(lower)) suggestions.push('Prefer narrower permissions such as 755 for executable directories/scripts or 644 for normal files when appropriate.');

  return {
    level,
    title:`${level[0].toUpperCase()}${level.slice(1)} risk`,
    summary: level === 'extreme' ? 'This command pattern can cause catastrophic data loss on a real Linux system.' : level === 'high' ? 'This command can materially change system state.' : level === 'medium' ? 'This command can modify system or user data.' : 'This command appears low-risk in normal use.',
    flags:[...new Set(flags)], suggestions
  };
}

export function permissionModeToSymbolic(mode) {
  const raw = String(mode || '').trim();
  if (!/^[0-7]{3}$/.test(raw)) throw new Error('Enter a three-digit Linux mode such as 644 or 755.');
  const map = ['---','--x','-w-','-wx','r--','r-x','rw-','rwx'];
  const [u,g,o] = [...raw].map(Number);
  return {
    mode:raw,
    symbolic:`${map[u]}${map[g]}${map[o]}`,
    owner:map[u], group:map[g], others:map[o],
    description:`Owner: ${describeTriplet(map[u])}; Group: ${describeTriplet(map[g])}; Others: ${describeTriplet(map[o])}.`
  };
}

function describeTriplet(value) {
  const actions = [];
  if (value[0] === 'r') actions.push('read');
  if (value[1] === 'w') actions.push('write');
  if (value[2] === 'x') actions.push('execute');
  return actions.length ? actions.join(', ') : 'no permissions';
}

export function symbolicToPermissionMode(input) {
  const value = String(input || '').trim().replace(/^-/,'');
  if (!/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/.test(value)) throw new Error('Enter nine permission characters such as rwxr-xr-x.');
  const chunks = [value.slice(0,3),value.slice(3,6),value.slice(6,9)];
  const digit = chunk => (chunk[0] === 'r' ? 4 : 0) + (chunk[1] === 'w' ? 2 : 0) + (chunk[2] === 'x' ? 1 : 0);
  return chunks.map(digit).join('');
}

export function translatePackageCommand(input, targetDistro='ubuntu') {
  const command = String(input || '').trim();
  if (!command) throw new Error('Enter a package command, for example: sudo apt install nginx');
  const distro = String(targetDistro || 'ubuntu').toLowerCase();
  const manager = PACKAGE_MANAGERS[distro];
  if (!manager) throw new Error(`Unsupported distro: ${targetDistro}`);
  const clean = command.replace(/^sudo\s+/i,'').trim();
  const match = clean.match(/^(apt(?:-get)?|dnf|yum|pacman)\s+(.+)$/i);
  if (!match) throw new Error('LinuxAid currently translates apt, dnf/yum and pacman package commands.');
  const source = match[1].toLowerCase();
  const rest = match[2].trim();

  let action = 'install';
  let packages = rest;
  if (source === 'pacman') {
    if (/^-s\s+/i.test(rest)) { action='install'; packages=rest.replace(/^-s\s+/i,''); }
    else if (/^-r\w*\s+/i.test(rest)) { action='remove'; packages=rest.replace(/^-r\w*\s+/i,''); }
    else if (/^-syu\b/i.test(rest)) { action='upgrade'; packages=''; }
  } else {
    const actionMatch = rest.match(/^(install|remove|erase|upgrade|update)\b\s*(.*)$/i);
    if (actionMatch) {
      action = actionMatch[1].toLowerCase();
      packages = actionMatch[2];
      if (action === 'erase') action='remove';
      if (action === 'update' && packages) action='upgrade';
    }
  }

  if (manager === 'apt') {
    if (action === 'upgrade') return 'sudo apt update && sudo apt upgrade';
    return `sudo apt ${action === 'remove' ? 'remove' : 'install'} ${packages}`.trim();
  }
  if (manager === 'dnf') {
    if (action === 'upgrade') return 'sudo dnf upgrade --refresh';
    return `sudo dnf ${action === 'remove' ? 'remove' : 'install'} ${packages}`.trim();
  }
  if (manager === 'pacman') {
    if (action === 'upgrade') return 'sudo pacman -Syu';
    return `sudo pacman ${action === 'remove' ? '-Rns' : '-S'} ${packages}`.trim();
  }
  throw new Error('Could not translate the command.');
}

export function interpretLinuxError(input) {
  const text = String(input || '').trim();
  if (!text) return { title:'No error entered', cause:'Paste a Linux error message or terminal output.', checks:[], fix:'LinuxAid will identify common causes and suggest inspection steps.' };
  const rule = ERROR_RULES.find(item => item.test.test(text));
  if (rule) return { title:rule.title, cause:rule.cause, checks:[...rule.checks], fix:rule.fix };
  return {
    title:'Unrecognized error pattern',
    cause:'LinuxAid does not have a deterministic match for this message yet.',
    checks:['Read the first error line carefully','Identify the command and target path/service','Check logs or status before changing anything'],
    fix:'Use the AI tutor with the full command, your distro and the exact error. Avoid trying random sudo/chmod commands.'
  };
}

export function getPackageManager(distro) {
  return PACKAGE_MANAGERS[String(distro || '').toLowerCase()] || null;
}
