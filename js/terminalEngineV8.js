import { createTerminalEngine as createBaseEngine, analyzeCommandSafety } from './terminalEngine.js';
import { getCommand } from './commandCatalog.js';

const BASE_REFERENCE = `alias apropos ar awk basename bash bg blkid blockdev break builtin bunzip2 bzcat bzip2 cal cat cd chage chattr chgrp chmod chown chpasswd chroot chsh cksum clear cmp comm command cp cpio cron crontab curl cut date dd df diff dig dirname dmesg dnsdomainname docker du echo egrep env ethtool exec exit expand export expr fallocate false fdisk fg file find findmnt firewall-cmd flock fmt fold free ftp fuser getent getopt git grep groups gunzip gzip halt hash head help history hostname hostnamectl htop id ifconfig ip ipcalc iperf iperf3 iptables jobs journalctl jq kill killall last less link ln locate logger login logname ls lsattr lsblk lscpu lsof make man md5sum mkdir mkfifo mknod mktemp modinfo modprobe more mount mv nano nc netcat networkctl nice nl nmcli nohup nproc nslookup openssl passwd paste patch pathchk ping ping6 pkill podman poweroff printenv printf ps pwd reboot renice reset rev rm rmdir route rsync scp sed seq service set setsid sftp sha1sum sha256sum sha512sum shred shutdown sleep sort source split ss ssh ssh-keygen stat strings su sudo swapoff swapon sync sysctl systemctl tac tail tar tee test time timeout top touch traceroute true truncate type ulimit umask uname unexpand uniq unlink uptime useradd userdel usermod users vim vmstat wait watch wc wget whatis whereis which who whoami xargs yes zip unzip zcat apt apt-cache apt-get apt-mark dpkg dnf rpm pacman yay zypper flatpak snap npm npx node pnpm yarn pip pip3 python python3 ruby gem php composer java javac gradle mvn go cargo rustc rustup gcc g++ clang cmake ninja make perl lua git-lfs gh kubectl helm terraform ansible ansible-playbook vagrant virsh qemu-system-x86_64 VBoxManage aws az gcloud sqlite3 mysql mariadb psql redis-cli mongosh ffmpeg ffprobe convert magick exiftool tmux screen strace ltrace gdb objdump readelf nm size strings tcpdump nmap socat dig host whois openssl ufw fail2ban-client semanage sestatus getenforce setenforce crictl ctr nerdctl`.split(/\s+/).filter(Boolean);

const FAMILIES = {
  git:`add am apply archive bisect blame branch bundle checkout cherry cherry-pick clean clone commit config describe diff fetch format-patch gc grep init log merge mv notes pull push range-diff rebase reflog remote reset restore revert rm shortlog show sparse-checkout stash status submodule switch tag worktree`.split(' '),
  docker:`attach build builder compose commit container context cp create diff events exec export history image images import info inspect kill load login logout logs network pause plugin port ps pull push rename restart rm rmi run save search secret service stack start stats stop swarm system tag top trust unpause update version volume wait`.split(' '),
  kubectl:`alpha annotate api-resources api-versions apply attach auth autoscale certificate cluster-info completion config cordon cp create debug delete describe diff drain edit events exec explain expose get kustomize label logs options patch plugin port-forward proxy replace rollout run scale set taint top uncordon version wait`.split(' '),
  systemctl:`cancel cat daemon-reexec daemon-reload default disable edit emergency enable exit halt help hibernate hybrid-sleep isolate is-active is-enabled is-failed kill link list-dependencies list-jobs list-sockets list-timers list-unit-files list-units mask preset reboot reload reload-or-restart rescue restart revert show show-environment start status stop suspend try-reload-or-restart unmask`.split(' '),
  journalctl:`--boot --catalog --disk-usage --dmesg --follow --list-boots --no-pager --priority --since --unit --until --user --vacuum-size --vacuum-time --verify`.split(' '),
  apt:`autoremove clean download edit-sources full-upgrade install list purge reinstall remove satisfy search show update upgrade`.split(' '),
  dnf:`autoremove check check-update clean distro-sync downgrade group history info install list makecache mark module provides reinstall remove repoquery repolist search swap update upgrade`.split(' '),
  nmcli:`agent connection device general help monitor networking radio`.split(' '),
  gh:`auth browse codespace gist issue pr release repo run search secret ssh-key status workflow`.split(' '),
  npm:`access adduser audit bugs cache ci completion config dedupe deprecate diff dist-tag docs doctor exec explain explore find-dupes fund help hook init install link login logout ls org outdated owner pack ping pkg prefix profile prune publish query rebuild repo restart root run-script search shrinkwrap star stars start stop team test token uninstall unpublish unstar update version view whoami`.split(' '),
  pip:`cache check config debug download freeze hash help index inspect install list show uninstall wheel`.split(' '),
  cargo:`bench build check clean clippy doc fetch fix generate-lockfile init install locate-project login metadata new owner package pkgid publish remove report run rustc rustdoc search test tree uninstall update vendor verify-project version yank`.split(' '),
  terraform:`apply console destroy env fmt force-unlock get graph import init login logout metadata output plan providers refresh show state taint test untaint validate version workspace`.split(' '),
  helm:`completion create dependency env get history install lint list package plugin pull push registry repo rollback search show status template test uninstall upgrade verify version`.split(' '),
  podman:`attach auto-update build commit compose container cp create diff events exec export generate healthcheck history image images import info init inspect kill kube load login logout logs machine manifest network pause pod port ps pull push restart rm rmi run save search secret start stats stop system tag top unpause unshare update version volume wait`.split(' ')
};

const COMMON_VARIANTS=['--help','--version','-h','--verbose'];
const REFERENCE_FORMS = (()=>{
  const set=new Set();
  BASE_REFERENCE.forEach(cmd=>{
    set.add(cmd);
    COMMON_VARIANTS.forEach(flag=>set.add(`${cmd} ${flag}`));
  });
  Object.entries(FAMILIES).forEach(([cmd,subs])=>subs.forEach(sub=>set.add(`${cmd} ${sub}`)));
  return [...set].sort();
})();

export const terminalReferenceCount = REFERENCE_FORMS.length;

function debugText(text=''){
  const value=String(text).trim();
  const lower=value.toLowerCase();
  if(!value)return `LinuxAid debug mode\n1. Re-run the failing command and copy the exact error.\n2. Run: pwd; whoami; id; df -h; free -h\n3. For services: systemctl status <service> and journalctl -u <service> --since today\n4. For networking: ip addr; ip route; ss -tulpn; ping -c 3 1.1.1.1\n5. Use: debug <paste the error>`;
  if(lower.includes('permission denied'))return `Permission denied\n• Check identity: whoami && id\n• Inspect ownership/permissions: ls -l <path> && stat <path>\n• Check parent directory permissions: namei -l <path>\n• Do not jump straight to chmod 777. Fix the smallest required permission.`;
  if(lower.includes('command not found'))return `Command not found\n• Confirm spelling and PATH: echo $PATH\n• Check: command -v <name> or which <name>\n• Search the package that provides it using your distro package manager.\n• Avoid curl|sh installers unless you trust and inspect the source.`;
  if(lower.includes('no space left'))return `No space left on device\n• df -h\n• df -i\n• sudo du -xhd1 /var 2>/dev/null | sort -h\n• journalctl --disk-usage\nCheck both disk blocks and inodes before deleting anything.`;
  if(lower.includes('connection refused'))return `Connection refused\n• Confirm service status: systemctl status <service>\n• Check listeners: ss -tulpn\n• Check host/port and firewall rules.\n• Read logs before restarting repeatedly.`;
  if(lower.includes('temporary failure in name resolution')||lower.includes('could not resolve')||lower.includes('name or service not known'))return `DNS / name resolution issue\n• ping -c 3 1.1.1.1\n• getent hosts example.com\n• resolvectl status (systemd-resolved systems)\n• ip route\nIf IP connectivity works but names fail, focus on DNS.`;
  if(lower.includes('failed to start')||lower.includes('failed with result'))return `Service failure\n• systemctl status <service> --no-pager\n• journalctl -u <service> -n 100 --no-pager\n• systemctl cat <service>\n• Validate the service config before restarting.`;
  if(lower.includes('lock')&&(lower.includes('apt')||lower.includes('dpkg')||lower.includes('package')))return `Package manager lock\n• Check running package processes first: ps aux | grep -E 'apt|dpkg'\n• Wait for legitimate background updates to finish.\n• Do not delete lock files blindly; repair interrupted dpkg state only after confirming no package process is active.`;
  return `Debug checklist for: ${value.slice(0,260)}\n• Capture exact command + complete error\n• Check current user, directory and permissions\n• Check disk/memory if the error mentions resources\n• Check service logs for daemon failures\n• Check IP, route, DNS and listening ports for network failures\n• Change one thing at a time, then verify.`;
}

function referenceSearch(query=''){
  const q=String(query).trim().toLowerCase();
  const results=q?REFERENCE_FORMS.filter(item=>item.includes(q)):REFERENCE_FORMS;
  return results.slice(0,80);
}

export function createTerminalEngine(initial={}){
  const base=createBaseEngine(initial);
  const baseExecute=base.execute.bind(base);

  function execute(raw){
    const input=String(raw||'').trim();
    const [first,...rest]=input.split(/\s+/);
    const cmd=(first||'').toLowerCase();
    if(cmd==='debug')return{output:debugText(rest.join(' ')),command:'debug',safety:{level:'safe',reason:'LinuxAid diagnostic guidance only; no system changes are made.'},cwd:base.state.cwd};
    if(cmd==='doctor')return{output:debugText(''),command:'doctor',safety:{level:'safe',reason:'Read-only diagnostic checklist.'},cwd:base.state.cwd};
    if(cmd==='commands'){
      const q=rest.join(' ');const rows=referenceSearch(q);
      return{output:`LinuxAid command reference: ${terminalReferenceCount.toLocaleString()} indexed command forms${q?` • matches for "${q}"`:''}\n${rows.join('\n')}${rows.length===80?'\n… refine the search to narrow results.':''}`,command:'commands',safety:{level:'safe',reason:'Reference lookup only.'},cwd:base.state.cwd};
    }
    if(cmd==='explain'){
      const target=rest.join(' ').trim();
      if(!target)return{output:'Usage: explain <command>',command:'explain',safety:{level:'safe',reason:'Reference lookup only.'},cwd:base.state.cwd};
      const baseName=target.split(/\s+/)[0];const info=getCommand(baseName);const safety=analyzeCommandSafety(target);
      return{output:info?`${info.name}: ${info.explanation}\nSyntax: ${info.syntax}\nSafety: ${safety.level.toUpperCase()} — ${safety.reason}`:`${target}\nSafety: ${safety.level.toUpperCase()} — ${safety.reason}\nThis command is in LinuxAid reference mode. Use man ${baseName} on a real Linux system for authoritative local documentation.`,command:'explain',safety,cwd:base.state.cwd};
    }
    const result=baseExecute(input);
    if(/command not found/.test(result.output||'')&&BASE_REFERENCE.includes(cmd)){
      const family=FAMILIES[cmd];
      const hint=family?.length?`\nCommon subcommands: ${family.slice(0,18).join(', ')}${family.length>18?', …':''}`:'';
      return{...result,output:`${cmd} is recognized by LinuxAid's command reference, but this browser terminal does not fake a real system action for it.${hint}\nUse: explain ${cmd} • commands ${cmd} • debug <error>\nRun it on a real Linux machine/VM/WSL when you need actual system output.`};
    }
    if(cmd==='help')result.output=`LinuxAid Terminal\nCore filesystem/network/service commands are safely simulated. ${terminalReferenceCount.toLocaleString()} command forms are indexed for search and guidance.\nNew: commands [query] • explain <command> • debug <error> • doctor\n${result.output}`;
    return result;
  }

  return{...base,execute,referenceCount:terminalReferenceCount,searchReference:referenceSearch,debug:debugText};
}

export { analyzeCommandSafety };
