import { createTerminalEngine as createLegacyEngine } from './terminalEngine.js';
import { COMMAND_UNIVERSE_V8,COMMAND_UNIVERSE_SET_V8,commandUniverseMatchesV8 } from './commandUniverseV8.js';

const CORE=new Set(['pwd','ls','cd','mkdir','touch','cat','head','tail','echo','printf','cp','mv','rm','grep','find','chmod','stat','du','df','free','ps','top','ping','ip','ss','apt','dnf','pacman','systemctl','journalctl','man','history','clear','which','whoami','id','hostname','uname','date']);
const HIGH_RISK=/^(mkfs|mkswap|fdisk|cfdisk|parted|dd|shred|wipefs|shutdown|reboot|poweroff|halt|iptables|chroot|userdel|groupdel)$/i;
const DEBUG_PLAYBOOKS={
  network:'Network debugging order:\n1. ip addr — confirm an address exists\n2. ip route — confirm a default route\n3. ping -c 4 1.1.1.1 — test raw reachability\n4. getent hosts example.com — test DNS\n5. ss -tulpn — inspect listening sockets\n6. curl -I https://example.com — test application-layer HTTP\nChange routes/firewall rules only after the failing layer is identified.',
  disk:'Disk debugging order:\n1. df -h — filesystem free space\n2. df -i — inode exhaustion\n3. du -xhd1 /path — find large directories\n4. lsblk -f — map disks/filesystems\n5. journalctl -k -p warning — inspect kernel storage warnings\nDo not run fsck on a mounted writable filesystem.',
  service:'Service debugging order:\n1. systemctl status SERVICE\n2. journalctl -u SERVICE --since today\n3. systemctl cat SERVICE — inspect unit definition\n4. ss -tulpn — verify expected listening port\n5. systemctl show SERVICE — inspect effective properties\nRestart only after you understand the failure.',
  permissions:'Permissions debugging order:\n1. id — inspect user/group membership\n2. namei -l /path/to/file — inspect every path component\n3. stat FILE — owner, group and mode\n4. getfacl FILE — ACLs when installed\n5. sudo -l — allowed sudo actions\nAvoid chmod 777; fix the smallest incorrect permission instead.',
  process:'Process debugging order:\n1. ps aux --sort=-%cpu\n2. top or htop\n3. pgrep -af NAME\n4. lsof -p PID\n5. strace -p PID only when appropriate\nPrefer SIGTERM before SIGKILL so processes can clean up.',
  boot:'Boot debugging order:\n1. systemctl --failed\n2. journalctl -b -p warning\n3. journalctl -b -1 — previous boot\n4. systemd-analyze blame\n5. dmesg -T | tail\nBack up important data before bootloader or filesystem repairs.'
};
function firstCommand(raw){return String(raw||'').trim().split(/\s+/)[0].toLowerCase()}
function genericReference(cmd,raw){const risk=HIGH_RISK.test(cmd)?'HIGH RISK — this command can make major system changes. Use its manual and backups before running it on a real machine.':'Recognized Linux/Unix/dev command. LinuxAid does not fake its side effects in the browser.';return `${cmd}: ${risk}\n\nTry on a real Linux machine: man ${cmd}\nSearch LinuxAid: commands.html?q=${encodeURIComponent(cmd)}\nEntered: ${raw}`}

export function createTerminalEngine(initial={}){
  const engine=createLegacyEngine(initial);const legacyExecute=engine.execute.bind(engine);const legacyAuto=engine.autocomplete.bind(engine);
  engine.execute=(raw)=>{
    const input=String(raw||'').trim();const cmd=firstCommand(input);const parts=input.split(/\s+/);
    if(cmd==='help')return{output:`LinuxAid Terminal V8\n${COMMAND_UNIVERSE_V8.length}+ commands recognized • ${CORE.size} core commands deeply simulated.\n\nUse:\n  commands [prefix]  search the command universe\n  man <command>      core manual / safe reference\n  debug <topic>      troubleshooting playbooks\n\nDebug topics: ${Object.keys(DEBUG_PLAYBOOKS).join(', ')}\nCore simulator: ${[...CORE].join(', ')}`,command:'help',safety:{level:'safe',reason:'Help only.'},cwd:engine.state.cwd};
    if(cmd==='commands'||cmd==='apropos'){
      const needle=parts.slice(1).join(' ');
      const matches=commandUniverseMatchesV8(needle,80);
      const label=needle?` Matches for “${needle}”`:` First ${matches.length}:`;
      return{output:`${COMMAND_UNIVERSE_V8.length} commands indexed.${label}\n${matches.join('  ')||'No matching command.'}`,command:cmd,safety:{level:'safe',reason:'Command catalog search only.'},cwd:engine.state.cwd};
    }
    if(cmd==='debug'){
      const topic=(parts[1]||'').toLowerCase();const text=DEBUG_PLAYBOOKS[topic];return{output:text||`Debug topics: ${Object.keys(DEBUG_PLAYBOOKS).join(', ')}\nExample: debug network`,command:'debug',safety:{level:'safe',reason:'Read-only troubleshooting guidance.'},cwd:engine.state.cwd};
    }
    const result=legacyExecute(input);
    if(cmd==='man'&&/^No manual entry/.test(result.output||'')){
      const target=(parts[1]||'').toLowerCase();if(COMMAND_UNIVERSE_SET_V8.has(target))return{...result,output:genericReference(target,`man ${target}`)};
    }
    if(/command not found/.test(result.output||'')&&COMMAND_UNIVERSE_SET_V8.has(cmd))return{...result,output:genericReference(cmd,input),recognized:true,safety:{level:HIGH_RISK.test(cmd)?'high':'safe',reason:HIGH_RISK.test(cmd)?'Recognized as a potentially destructive system command; LinuxAid will not fake execution.':'Recognized safely; reference mode only.'}};
    return result;
  };
  engine.autocomplete=input=>{const value=String(input||'');if(/\s/.test(value.trim()))return legacyAuto(value);const matches=commandUniverseMatchesV8(value.trim(),2);return matches.length===1?matches[0]:legacyAuto(value)};
  engine.commandUniverse=COMMAND_UNIVERSE_V8;
  return engine;
}
