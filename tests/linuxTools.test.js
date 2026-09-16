import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeLinuxCommand, permissionModeToSymbolic, symbolicToPermissionMode,
  translatePackageCommand, interpretLinuxError, getPackageManager
} from '../js/linuxTools.js';

test('command analyzer classifies destructive root deletion as extreme', () => {
  const result = analyzeLinuxCommand('sudo rm -rf /');
  assert.equal(result.level, 'extreme');
  assert.match(result.summary, /catastrophic/i);
});

test('command analyzer marks read-only inspection as safe', () => {
  assert.equal(analyzeLinuxCommand('ls -la /var/log').level, 'safe');
  assert.equal(analyzeLinuxCommand('ip route').level, 'safe');
});

test('permission decoder converts 755 and symbolic modes both ways', () => {
  const decoded = permissionModeToSymbolic('755');
  assert.equal(decoded.symbolic, 'rwxr-xr-x');
  assert.equal(symbolicToPermissionMode('rwxr-xr-x'), '755');
  assert.equal(symbolicToPermissionMode('-rw-r--r--'), '644');
});

test('package command translator converts apt to Fedora and Arch syntax', () => {
  assert.equal(translatePackageCommand('sudo apt install nginx', 'fedora'), 'sudo dnf install nginx');
  assert.equal(translatePackageCommand('apt install nginx', 'arch'), 'sudo pacman -S nginx');
  assert.equal(translatePackageCommand('sudo dnf remove nginx', 'ubuntu'), 'sudo apt remove nginx');
});

test('error interpreter recognizes permission and DNS failures', () => {
  assert.equal(interpretLinuxError('bash: ./deploy.sh: Permission denied').title, 'Permission denied');
  assert.equal(interpretLinuxError('curl: (6) Could not resolve host: example.com').title, 'DNS resolution failure');
});

test('distro manager resolver covers common Linux families', () => {
  assert.equal(getPackageManager('Kali'), 'apt');
  assert.equal(getPackageManager('Fedora'), 'dnf');
  assert.equal(getPackageManager('Manjaro'), 'pacman');
});
