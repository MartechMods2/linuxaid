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
  achievements: [],
  labsCompleted: 0,
  lessonsCompleted: 0,
  quizzesCompleted: 0,
  perfectQuizzes: 0,
  dailyChallenges: 0,
  gameStats: { plays:0, questions:0, correct:0, bestPercent:0 },
  gameRewardLedger: {},
  dailyRewardKeys: [],
  streakDays: 0,
  lastActiveDate: null,
  firstSeenAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

function storageAvailable() {
  try { return typeof localStorage !== 'undefined'; } catch { return false; }
}

function emitProgress(progress) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('linuxaid:progress-changed',{ detail:{ progress } }));
}

export function readProgress() {
  if (!storageAvailable()) return freshProgress();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return freshProgress();
    return {
      ...freshProgress(), ...parsed,
      learnedCommands:Array.isArray(parsed.learnedCommands) ? parsed.learnedCommands : [],
      achievements:Array.isArray(parsed.achievements) ? parsed.achievements : []
    };
  } catch { return freshProgress(); }
}

function dayKey(date = new Date()) { return date.toISOString().slice(0,10); }
function daysBetween(a,b) { return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000); }

export function writeProgress(progress, { silent=false } = {}) {
  const normalized = {
    ...freshProgress(), ...progress,
    xp:Math.max(0, Math.round(Number(progress.xp) || 0)),
    commandsRun:Math.max(0, Math.round(Number(progress.commandsRun) || 0)),
    labsCompleted:Math.max(0, Math.round(Number(progress.labsCompleted) || 0)),
    lessonsCompleted:Math.max(0, Math.round(Number(progress.lessonsCompleted) || 0)),
    quizzesCompleted:Math.max(0, Math.round(Number(progress.quizzesCompleted) || 0)),
    perfectQuizzes:Math.max(0, Math.round(Number(progress.perfectQuizzes) || 0)),
    dailyChallenges:Math.max(0, Math.round(Number(progress.dailyChallenges) || 0)),
    gameStats:{
      plays:Math.max(0,Math.round(Number(progress.gameStats?.plays)||0)),
      questions:Math.max(0,Math.round(Number(progress.gameStats?.questions)||0)),
      correct:Math.max(0,Math.round(Number(progress.gameStats?.correct)||0)),
      bestPercent:Math.max(0,Math.min(100,Math.round(Number(progress.gameStats?.bestPercent)||0)))
    },
    gameRewardLedger:progress.gameRewardLedger && typeof progress.gameRewardLedger === 'object' ? progress.gameRewardLedger : {},
    dailyRewardKeys:[...new Set((progress.dailyRewardKeys || []).map(String))].slice(-90),
    learnedCommands:[...new Set((progress.learnedCommands || []).map(value => String(value).toLowerCase()))].slice(0,250),
    achievements:[...new Set((progress.achievements || []).map(String))].slice(0,100),
    updatedAt:new Date().toISOString()
  };
  if (storageAvailable()) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (!silent) emitProgress(normalized);
  return normalized;
}

function touchStreak(progress) {
  const today = dayKey();
  if (progress.lastActiveDate !== today) {
    const delta = progress.lastActiveDate ? daysBetween(progress.lastActiveDate, today) : null;
    progress.streakDays = delta === 1 ? (progress.streakDays || 0) + 1 : 1;
    progress.lastActiveDate = today;
  }
  return progress;
}

function unlockAchievements(progress) {
  const set = new Set(progress.achievements || []);
  if ((progress.learnedCommands || []).length >= 5) set.add('First Five');
  if ((progress.learnedCommands || []).length >= 20) set.add('Command Explorer');
  if ((progress.commandsRun || 0) >= 100) set.add('Terminal Regular');
  if ((progress.streakDays || 0) >= 7) set.add('Seven Day Streak');
  if ((progress.labsCompleted || 0) >= 5) set.add('Lab Solver');
  if ((progress.lessonsCompleted || 0) >= 10) set.add('Skill Builder');
  if ((progress.quizzesCompleted || 0) >= 1) set.add('Quiz Starter');
  if ((progress.perfectQuizzes || 0) >= 1) set.add('Perfect Round');
  if ((progress.quizzesCompleted || 0) >= 10) set.add('Command Gamer');
  if ((progress.dailyChallenges || 0) >= 7) set.add('Daily Challenger');
  if ((progress.xp || 0) >= 1000) set.add('LinuxAid 1K');
  progress.achievements = [...set];
  return progress;
}

export function recordCommandUsage(command) {
  const name = String(command || '').toLowerCase().trim();
  if (!name) return readProgress();
  const progress = touchStreak(readProgress());
  progress.commandsRun = (progress.commandsRun || 0) + 1;
  if (!progress.learnedCommands.includes(name)) {
    progress.learnedCommands.push(name);
    progress.xp = (progress.xp || 0) + 15;
  } else progress.xp = (progress.xp || 0) + 2;
  const result = writeProgress(unlockAchievements(progress));
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('linuxaid:command-run',{ detail:{ command:name } }));
  return result;
}

export function awardXP(amount, reason='learning', counters={}) {
  const progress = touchStreak(readProgress());
  progress.xp = (progress.xp || 0) + Math.max(0, Math.min(5000, Number(amount) || 0));
  if (counters.lab) progress.labsCompleted = (progress.labsCompleted || 0) + 1;
  if (counters.lesson) progress.lessonsCompleted = (progress.lessonsCompleted || 0) + 1;
  progress.lastRewardReason = String(reason).slice(0,120);
  return writeProgress(unlockAchievements(progress));
}

export function recordGameResult({ score=0, total=1, mode='quick', dailyKey='', reason='LinuxAid Play' } = {}) {
  const safeTotal=Math.max(1,Math.min(50,Math.round(Number(total)||1)));
  const safeScore=Math.max(0,Math.min(safeTotal,Math.round(Number(score)||0)));
  const percent=Math.round((safeScore/safeTotal)*100);
  const progress=touchStreak(readProgress());
  const stats=progress.gameStats && typeof progress.gameStats==='object' ? progress.gameStats : {};
  progress.gameStats={
    plays:(Number(stats.plays)||0)+1,
    questions:(Number(stats.questions)||0)+safeTotal,
    correct:(Number(stats.correct)||0)+safeScore,
    bestPercent:Math.max(Number(stats.bestPercent)||0,percent)
  };
  progress.quizzesCompleted=(progress.quizzesCompleted||0)+1;
  if(percent===100) progress.perfectQuizzes=(progress.perfectQuizzes||0)+1;

  const today=dayKey();
  const ledger=progress.gameRewardLedger && typeof progress.gameRewardLedger==='object' ? progress.gameRewardLedger : {};
  const earnedToday=Math.max(0,Number(ledger[today])||0);
  const baseReward=Math.max(4,Math.min(28,6+(safeScore*3)));
  let reward=Math.max(0,Math.min(baseReward,120-earnedToday));

  if(dailyKey){
    const keys=new Set(progress.dailyRewardKeys||[]);
    if(!keys.has(dailyKey)){
      keys.add(dailyKey);
      progress.dailyChallenges=(progress.dailyChallenges||0)+1;
      reward+=25;
      progress.dailyRewardKeys=[...keys].slice(-90);
    }
  }

  ledger[today]=Math.min(145,earnedToday+reward);
  progress.gameRewardLedger=Object.fromEntries(Object.entries(ledger).slice(-14));
  progress.xp=(progress.xp||0)+reward;
  progress.lastRewardReason=String(reason).slice(0,120);
  const result=writeProgress(unlockAchievements(progress));
  if(typeof document!=='undefined') document.dispatchEvent(new CustomEvent('linuxaid:game-result',{detail:{score:safeScore,total:safeTotal,percent,reward,mode,dailyKey,progress:result}}));
  return { progress:result, reward, percent };
}

export function calculateRoadmap(progress = readProgress()) {
  const learned = new Set(progress.learnedCommands || []);
  const percentage = commands => Math.round((commands.filter(command => learned.has(command)).length / commands.length) * 100);
  return { beginner:percentage(SKILL_BUCKETS.beginner), intermediate:percentage(SKILL_BUCKETS.intermediate), advanced:percentage(SKILL_BUCKETS.advanced) };
}

export function getProgressSummary(progress = readProgress()) {
  const roadmap = calculateRoadmap(progress);
  return {
    ...progress, roadmap,
    level: progress.xp >= 1600 ? 'Linux Navigator' : progress.xp >= 1000 ? 'Advanced Explorer' : progress.xp >= 500 ? 'Linux Builder' : progress.xp >= 150 ? 'Command Learner' : 'Linux Starter',
    nextLevelXp: progress.xp >= 1600 ? 2500 : progress.xp >= 1000 ? 1600 : progress.xp >= 500 ? 1000 : progress.xp >= 150 ? 500 : 150
  };
}

export function exportProgress() {
  return { version:2, exportedAt:new Date().toISOString(), progress:readProgress() };
}

export function importProgress(payload, options={}) {
  const data = payload?.progress || payload;
  if (!data || typeof data !== 'object') throw new Error('Invalid LinuxAid progress file.');
  return writeProgress(data, options);
}

export function resetProgress() {
  if (storageAvailable()) localStorage.removeItem(STORAGE_KEY);
  const fresh = freshProgress();
  emitProgress(fresh);
  return fresh;
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
