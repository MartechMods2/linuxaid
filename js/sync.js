import {
  initBackend, getBackendStatus, onAuthStateChangedListener,
  loadSyncedProgress, saveSyncedProgress
} from '../backend.js';
import { readProgress, writeProgress } from './progress.js';
import { readLearningState, writeLearningState } from './learningData.js';

const config = window.LINUXAID_CONFIG || {};
let currentUser = null;
let syncTimer = null;
let syncing = false;
let initialized = false;

function maxDate(a,b) {
  const av = a ? Date.parse(a) : 0;
  const bv = b ? Date.parse(b) : 0;
  return av >= bv ? a : b;
}

function minDate(a,b) {
  const av = a ? Date.parse(a) : Infinity;
  const bv = b ? Date.parse(b) : Infinity;
  if (!Number.isFinite(av) && !Number.isFinite(bv)) return new Date().toISOString();
  return av <= bv ? a : b;
}

function mergeProgress(local = {}, remote = {}) {
  const localCommands = Array.isArray(local.learnedCommands) ? local.learnedCommands : [];
  const remoteCommands = Array.isArray(remote.learnedCommands) ? remote.learnedCommands : [];
  const localAchievements = Array.isArray(local.achievements) ? local.achievements : [];
  const remoteAchievements = Array.isArray(remote.achievements) ? remote.achievements : [];
  return {
    ...remote,
    ...local,
    xp:Math.max(Number(local.xp)||0, Number(remote.xp)||0),
    commandsRun:Math.max(Number(local.commandsRun)||0, Number(remote.commandsRun)||0),
    labsCompleted:Math.max(Number(local.labsCompleted)||0, Number(remote.labsCompleted)||0),
    lessonsCompleted:Math.max(Number(local.lessonsCompleted)||0, Number(remote.lessonsCompleted)||0),
    quizzesCompleted:Math.max(Number(local.quizzesCompleted)||0, Number(remote.quizzesCompleted)||0),
    perfectQuizzes:Math.max(Number(local.perfectQuizzes)||0, Number(remote.perfectQuizzes)||0),
    dailyChallenges:Math.max(Number(local.dailyChallenges)||0, Number(remote.dailyChallenges)||0),
    gameStats:{
      plays:Math.max(Number(local.gameStats?.plays)||0,Number(remote.gameStats?.plays)||0),
      questions:Math.max(Number(local.gameStats?.questions)||0,Number(remote.gameStats?.questions)||0),
      correct:Math.max(Number(local.gameStats?.correct)||0,Number(remote.gameStats?.correct)||0),
      bestPercent:Math.max(Number(local.gameStats?.bestPercent)||0,Number(remote.gameStats?.bestPercent)||0)
    },
    gameRewardLedger:{ ...(remote.gameRewardLedger||{}), ...(local.gameRewardLedger||{}) },
    dailyRewardKeys:[...new Set([...(remote.dailyRewardKeys||[]),...(local.dailyRewardKeys||[])])].slice(-90),
    streakDays:Math.max(Number(local.streakDays)||0, Number(remote.streakDays)||0),
    learnedCommands:[...new Set([...localCommands,...remoteCommands])],
    achievements:[...new Set([...localAchievements,...remoteAchievements])],
    firstSeenAt:minDate(local.firstSeenAt,remote.firstSeenAt),
    lastActiveDate:maxDate(local.lastActiveDate,remote.lastActiveDate),
    updatedAt:maxDate(local.updatedAt,remote.updatedAt) || new Date().toISOString()
  };
}

function mergeLearning(local = {}, remote = {}) {
  const localLessons=Array.isArray(local.completedLessons)?local.completedLessons:[];
  const remoteLessons=Array.isArray(remote.completedLessons)?remote.completedLessons:[];
  const localLabs=Array.isArray(local.completedLabs)?local.completedLabs:[];
  const remoteLabs=Array.isArray(remote.completedLabs)?remote.completedLabs:[];
  const quizScores={ ...(remote.quizScores || {}) };
  for (const [key,value] of Object.entries(local.quizScores || {})) {
    quizScores[key]=Math.max(Number(quizScores[key])||0,Number(value)||0);
  }
  return {
    completedLessons:[...new Set([...localLessons,...remoteLessons])],
    completedLabs:[...new Set([...localLabs,...remoteLabs])],
    quizScores
  };
}

async function pushNow() {
  if (!currentUser?.uid || syncing) return;
  syncing=true;
  try {
    await saveSyncedProgress(readProgress(),readLearningState(),currentUser.uid);
    document.dispatchEvent(new CustomEvent('linuxaid:sync-status',{ detail:{ status:'synced', at:new Date().toISOString() } }));
  } catch(error) {
    console.warn('LinuxAid sync failed:',error);
    document.dispatchEvent(new CustomEvent('linuxaid:sync-status',{ detail:{ status:'error', message:error.message || 'Sync failed' } }));
  } finally { syncing=false; }
}

function schedulePush(delay=650) {
  if (!currentUser?.uid) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(pushNow,delay);
}

async function restoreAndMerge(user) {
  if (!user?.uid) return;
  try {
    const remote=await loadSyncedProgress(user.uid);
    const localProgress=readProgress();
    const localLearning=readLearningState();
    const progress=mergeProgress(localProgress,remote?.progress || {});
    const learning=mergeLearning(localLearning,remote?.learning || {});
    writeProgress(progress,{ silent:true });
    writeLearningState(learning,{ silent:true });
    await saveSyncedProgress(progress,learning,user.uid);
    document.dispatchEvent(new CustomEvent('linuxaid:state-synced',{ detail:{ progress,learning,user } }));
  } catch(error) {
    console.warn('LinuxAid remote restore failed:',error);
  }
}

export async function initSync() {
  if (initialized) return;
  initialized=true;
  await initBackend(config);
  const backend=getBackendStatus();
  if (!backend.ready) return;
  currentUser=backend.user || null;
  if (currentUser) await restoreAndMerge(currentUser);
  onAuthStateChangedListener(async user=>{
    currentUser=user || null;
    if (currentUser) await restoreAndMerge(currentUser);
  });
}

document.addEventListener('linuxaid:progress-changed',()=>schedulePush());
document.addEventListener('linuxaid:learning-changed',()=>schedulePush());
window.addEventListener('pagehide',()=>{
  if (currentUser?.uid && !syncing) void pushNow();
});

void initSync();
