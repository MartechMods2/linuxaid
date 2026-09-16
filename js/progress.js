const STORAGE_KEY = 'linuxaid-progress-v2';

export const SKILL_BUCKETS = Object.freeze({
  beginner: ['pwd','ls','cd','mkdir','touch','cat','cp','mv','rm','echo','history','man'],
  intermediate: ['grep','find','head','tail','chmod','stat','du','df','ps','free','ping','ip','ss','apt','dnf','pacman'],
  advanced: ['sudo','chown','kill','systemctl','journalctl','curl','wget','ssh','tar']
});

const freshProgress = () => ({
  xp: 0,
  commandsRun: 0,
  learnedCommands: [],
  streakDays: 0,
  lastActiveDate: null,
  firstSeenAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readProgress() {
  if (!storageAvailable()) return freshProgress();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return freshProgress();
    return { ...freshProgress(), ...parsed, learnedCommands:Array.isArray(parsed.learnedCommands) ? parsed.learnedCommands : [] };
  } catch {
    return freshProgress();
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0,10);
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

export function writeProgress(progress) {
  const normalized = {
    ...freshProgress(),
    ...progress,
    learnedCommands:[...new Set((progress.learnedCommands || []).map(value => String(value).toLowerCase()))].slice(0,250),
    updatedAt:new Date().toISOString()
  };
  if (storageAvailable()) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function recordCommandUsage(command) {
  const name = String(command || '').toLowerCase().trim();
  if (!name) return readProgress();
  const progress = readProgress();
  const today = dayKey();
  if (progress.lastActiveDate !== today) {
    const delta = progress.lastActiveDate ? daysBetween(progress.lastActiveDate, today) : null;
    progress.streakDays = delta === 1 ? (progress.streakDays || 0) + 1 : 1;
    progress.lastActiveDate = today;
  }
  progress.commandsRun = (progress.commandsRun || 0) + 1;
  if (!progress.learnedCommands.includes(name)) {
    progress.learnedCommands.push(name);
    progress.xp = (progress.xp || 0) + 15;
  } else {
    progress.xp = (progress.xp || 0) + 2;
  }
  return writeProgress(progress);
}

export function calculateRoadmap(progress = readProgress()) {
  const learned = new Set(progress.learnedCommands || []);
  const percentage = commands => Math.round((commands.filter(command => learned.has(command)).length / commands.length) * 100);
  return {
    beginner:percentage(SKILL_BUCKETS.beginner),
    intermediate:percentage(SKILL_BUCKETS.intermediate),
    advanced:percentage(SKILL_BUCKETS.advanced)
  };
}

export function getProgressSummary(progress = readProgress()) {
  const roadmap = calculateRoadmap(progress);
  return {
    ...progress,
    roadmap,
    level: progress.xp >= 1200 ? 'Advanced Explorer' : progress.xp >= 500 ? 'Linux Builder' : progress.xp >= 150 ? 'Command Learner' : 'Linux Starter'
  };
}

export function renderRoadmapProgress(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  const values = calculateRoadmap();
  const cards = [...root.querySelectorAll('.roadmap-card')];
  ['beginner','intermediate','advanced'].forEach((key,index) => {
    const card = cards[index];
    if (!card) return;
    const fill = card.querySelector('.progress-fill');
    if (fill) fill.style.width = `${values[key]}%`;
    const labels = card.querySelectorAll('p');
    const progressLabel = labels[labels.length - 1];
    if (progressLabel) progressLabel.textContent = `${values[key]}% complete`;
  });
}
