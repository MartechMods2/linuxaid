export const COURSES = [
  {
    id:'linux-foundations', icon:'fa-terminal', level:'Beginner', duration:'2–3 hours', xp:240,
    title:'Linux Foundations', description:'Build the command-line habits every Linux learner needs before moving into administration.',
    lessons:[
      { id:'shell-orientation', title:'Shell orientation', minutes:12, summary:'Understand prompts, paths, users and where commands run.', practice:['pwd','whoami','uname -a'] },
      { id:'navigation', title:'Filesystem navigation', minutes:18, summary:'Move confidently with pwd, ls and cd.', practice:['pwd','ls -la','cd projects'] },
      { id:'files', title:'Create and manage files', minutes:24, summary:'Use touch, mkdir, cp, mv and rm safely.', practice:['touch notes.txt','mkdir practice','cp notes.txt practice/notes-copy.txt'] },
      { id:'reading', title:'Read and search content', minutes:22, summary:'Inspect files with cat, head, tail, grep and find.', practice:['cat README.md','grep Linux README.md','find . README.md'] },
      { id:'permissions', title:'Permissions without panic', minutes:28, summary:'Read permission bits and make minimal chmod changes.', practice:['ls -l','chmod 755 projects/starter.sh','stat projects/starter.sh'] }
    ],
    quiz:[
      { q:'Which command prints your current directory?', options:['pwd','ps','whoami','find'], answer:0 },
      { q:'Which mode is a common safe choice for executable scripts?', options:['777','755','000','666'], answer:1 },
      { q:'Which command searches file contents for matching text?', options:['grep','cd','mkdir','uname'], answer:0 }
    ]
  },
  {
    id:'linux-admin', icon:'fa-server', level:'Intermediate', duration:'3–4 hours', xp:360,
    title:'Linux Administration', description:'Learn users, processes, services, storage and logs through a safe operational workflow.',
    lessons:[
      { id:'identity', title:'Users and identity', minutes:25, summary:'Understand id, groups, sudo and ownership.', practice:['id','whoami','sudo --help'] },
      { id:'processes', title:'Processes and resources', minutes:30, summary:'Inspect processes and system pressure before changing anything.', practice:['ps','free -h','df -h'] },
      { id:'services', title:'Systemd services', minutes:32, summary:'Use status and logs before restart actions.', practice:['systemctl status ssh','journalctl -u ssh'] },
      { id:'storage', title:'Storage investigation', minutes:28, summary:'Measure disk usage and locate large paths safely.', practice:['df -h','du -sh .'] },
      { id:'archives', title:'Archives and backups', minutes:24, summary:'Create and inspect tar archives before extraction.', practice:['tar -czf backup.tar.gz projects'] }
    ],
    quiz:[
      { q:'What should you usually do before restarting a failed service?', options:['Delete its logs','Check status and logs','Run chmod 777','Reboot immediately'], answer:1 },
      { q:'Which command shows filesystem free space?', options:['df','du','ps','id'], answer:0 },
      { q:'Which command shows the current user and group IDs?', options:['id','ip','ss','cat'], answer:0 }
    ]
  },
  {
    id:'linux-networking', icon:'fa-network-wired', level:'Intermediate', duration:'2–3 hours', xp:320,
    title:'Linux Networking', description:'Diagnose connectivity methodically instead of randomly changing settings.',
    lessons:[
      { id:'interfaces', title:'Interfaces and addresses', minutes:22, summary:'Inspect local interfaces and IP addresses.', practice:['ip addr'] },
      { id:'routes', title:'Routes and gateways', minutes:22, summary:'Understand how packets leave the machine.', practice:['ip route'] },
      { id:'reachability', title:'Reachability tests', minutes:25, summary:'Separate local, gateway and internet failures.', practice:['ping -c 4 1.1.1.1'] },
      { id:'ports', title:'Listening ports', minutes:28, summary:'Inspect listening sockets with ss.', practice:['ss -tulpn'] },
      { id:'remote', title:'Remote access basics', minutes:30, summary:'Understand SSH connection patterns and common failures.', practice:['ssh user@example.com'] }
    ],
    quiz:[
      { q:'Which command shows routes?', options:['ip route','df -h','history','tar'], answer:0 },
      { q:'Which tool inspects listening sockets?', options:['ss','pwd','chmod','free'], answer:0 },
      { q:'A successful ping to 1.1.1.1 but failed hostname lookup suggests what?', options:['Disk failure','DNS problem','Permission problem','CPU failure'], answer:1 }
    ]
  },
  {
    id:'bash-automation', icon:'fa-code', level:'Intermediate', duration:'3 hours', xp:340,
    title:'Bash & Automation', description:'Move from repeating commands manually to clear, inspectable shell workflows.',
    lessons:[
      { id:'variables', title:'Variables and expansion', minutes:24, summary:'Use shell variables safely and predict expansion.', practice:['echo $PATH'] },
      { id:'pipes', title:'Pipes and filtering', minutes:30, summary:'Combine command output into readable workflows.', practice:['cat README.md | grep Linux'] },
      { id:'redirection', title:'Redirection', minutes:25, summary:'Understand > and >> before writing to files.', practice:['echo hello > notes.txt','cat notes.txt'] },
      { id:'scripts', title:'Executable scripts', minutes:34, summary:'Understand shebangs, chmod +x and predictable paths.', practice:['chmod +x projects/starter.sh'] },
      { id:'automation-safety', title:'Automation safety', minutes:28, summary:'Add checks before destructive or privileged actions.', practice:['history'] }
    ],
    quiz:[
      { q:'What does >> usually do?', options:['Overwrite a file','Append output','Delete output','Change permission'], answer:1 },
      { q:'What should a script do before destructive changes?', options:['Assume paths are correct','Validate inputs and targets','Always use sudo','Disable logs'], answer:1 },
      { q:'Which character connects one command output to another command input?', options:['|','&','~','@'], answer:0 }
    ]
  }
];

export const LABS = [
  {
    id:'permission-denied', difficulty:'Beginner', xp:70, icon:'fa-key', title:'Fix Permission Denied',
    scenario:'A script exists but will not execute. Inspect it before changing permissions.',
    objective:'Inspect the script and give it executable permission without opening write access to everyone.',
    expected:['ls','chmod'], hints:['Start with `ls -l projects/starter.sh`.','A mode such as 755 gives the owner write access while others can read/execute.']
  },
  {
    id:'find-file', difficulty:'Beginner', xp:55, icon:'fa-magnifying-glass', title:'Find the Missing File',
    scenario:'You know README.md exists somewhere in the simulated home tree, but not exactly where.',
    objective:'Use a search command to locate README.md.', expected:['find'], hints:['`find` can search recursively from a starting path.']
  },
  {
    id:'disk-check', difficulty:'Beginner', xp:60, icon:'fa-hard-drive', title:'Investigate Disk Usage',
    scenario:'A teammate says the machine is “out of space.” Do not delete anything yet.',
    objective:'Check filesystem capacity and directory usage first.', expected:['df','du'], hints:['Use `df -h` for filesystems and `du -sh .` for the current directory.']
  },
  {
    id:'service-debug', difficulty:'Intermediate', xp:90, icon:'fa-gears', title:'Debug a Service',
    scenario:'An SSH service is reported unhealthy.',
    objective:'Inspect service status and then inspect its logs before considering a restart.', expected:['systemctl','journalctl'], hints:['Start with `systemctl status ssh`.']
  },
  {
    id:'network-triage', difficulty:'Intermediate', xp:95, icon:'fa-network-wired', title:'Network Triage',
    scenario:'A server cannot reach an external site.',
    objective:'Inspect address, route and basic reachability in a sensible order.', expected:['ip','ping'], hints:['Inspect `ip addr` and `ip route` before testing reachability.']
  },
  {
    id:'grep-log', difficulty:'Intermediate', xp:75, icon:'fa-file-lines', title:'Search the Logs',
    scenario:'You need to find every line containing “Linux” in README.md without reading it manually.',
    objective:'Use grep to filter matching lines.', expected:['grep'], hints:['Try `grep Linux README.md`.']
  },
  {
    id:'safe-copy', difficulty:'Intermediate', xp:80, icon:'fa-copy', title:'Make a Safe Backup Copy',
    scenario:'Before editing notes.txt, create a separate backup copy and verify it exists.',
    objective:'Copy the file and list the directory.', expected:['cp','ls'], hints:['Use `cp source destination`, then `ls`.']
  },
  {
    id:'archive-project', difficulty:'Intermediate', xp:100, icon:'fa-box-archive', title:'Archive a Project',
    scenario:'You need a compressed backup of the projects directory.',
    objective:'Create a gzip-compressed tar archive.', expected:['tar'], hints:['A common pattern is `tar -czf backup.tar.gz projects`.']
  }
];

export const LEARNING_STORAGE_KEY = 'linuxaid-learning-v1';

export function readLearningState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') throw new Error('empty');
    return {
      completedLessons:Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedLabs:Array.isArray(parsed.completedLabs) ? parsed.completedLabs : [],
      quizScores:parsed.quizScores && typeof parsed.quizScores === 'object' ? parsed.quizScores : {}
    };
  } catch {
    return { completedLessons:[], completedLabs:[], quizScores:{} };
  }
}

export function writeLearningState(state) {
  const normalized = {
    completedLessons:[...new Set(state.completedLessons || [])].slice(0,500),
    completedLabs:[...new Set(state.completedLabs || [])].slice(0,200),
    quizScores:state.quizScores || {}
  };
  localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getCourseProgress(course, state=readLearningState()) {
  const ids = course.lessons.map(lesson => `${course.id}:${lesson.id}`);
  const done = ids.filter(id => state.completedLessons.includes(id)).length;
  return { done, total:ids.length, percent:Math.round((done / ids.length) * 100) };
}
