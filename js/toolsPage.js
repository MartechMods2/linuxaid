import {
  analyzeLinuxCommand, permissionModeToSymbolic, symbolicToPermissionMode,
  translatePackageCommand, interpretLinuxError
} from './linuxTools.js';

const $ = id => document.getElementById(id);

function renderCommandAnalysis() {
  const result = analyzeLinuxCommand($('commandToAnalyze')?.value || '');
  const target = $('commandAnalysisResult');
  if (!target) return;
  const icon = result.level === 'extreme' ? '⛔' : result.level === 'high' ? '🔴' : result.level === 'medium' ? '🟠' : '🟢';
  target.textContent = `${icon} ${result.title}\n${result.summary}\n\n${result.flags.length ? `Flags:\n• ${result.flags.join('\n• ')}\n\n` : ''}Safer thinking:\n• ${result.suggestions.join('\n• ')}`;
}

function renderPermission() {
  const value = $('permissionInput')?.value.trim() || '';
  const target = $('permissionResult');
  if (!target) return;
  try {
    if (/^[0-7]{3}$/.test(value)) {
      const result = permissionModeToSymbolic(value);
      target.textContent = `${result.mode} → ${result.symbolic}\n${result.description}`;
    } else {
      const mode = symbolicToPermissionMode(value);
      const result = permissionModeToSymbolic(mode);
      target.textContent = `${value.replace(/^-/,'')} → ${mode}\n${result.description}`;
    }
  } catch (error) {
    target.textContent = error.message;
  }
}

function renderTranslation() {
  const target = $('translationResult');
  if (!target) return;
  try {
    target.textContent = translatePackageCommand($('packageCommand')?.value || '', $('targetDistro')?.value || 'ubuntu');
  } catch (error) {
    target.textContent = error.message;
  }
}

function renderError() {
  const target = $('errorResult');
  if (!target) return;
  const result = interpretLinuxError($('errorInput')?.value || '');
  target.textContent = `${result.title}\n\nLikely cause:\n${result.cause}\n\nCheck first:\n• ${result.checks.join('\n• ')}\n\nSafer next step:\n${result.fix}`;
}

$('analyzeCommand')?.addEventListener('click', renderCommandAnalysis);
$('decodePermission')?.addEventListener('click', renderPermission);
$('translateCommand')?.addEventListener('click', renderTranslation);
$('interpretError')?.addEventListener('click', renderError);

for (const [inputId, action] of [
  ['permissionInput',renderPermission],
  ['packageCommand',renderTranslation]
]) {
  $(inputId)?.addEventListener('keydown', event => { if (event.key === 'Enter') action(); });
}
