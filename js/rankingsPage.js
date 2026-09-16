import { renderRankPanel, renderRankLadder } from './ranks.js';
import { getProgressSummary } from './progress.js';

const summary = getProgressSummary();
renderRankPanel(document.querySelector('[data-rank-panel]'), summary);
renderRankLadder(document.getElementById('fullRankLadder'), summary);

document.addEventListener('linuxaid:command-run', () => {
  const next = getProgressSummary();
  renderRankPanel(document.querySelector('[data-rank-panel]'), next);
  renderRankLadder(document.getElementById('fullRankLadder'), next);
});
