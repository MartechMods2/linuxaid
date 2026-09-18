import { COURSES, LABS, readLearningState, writeLearningState, getCourseProgress } from './learningData.js';
import { createTerminalEngine } from './terminalEngine.js';
import { awardXP, getProgressSummary } from './progress.js';

const page = document.body.dataset.page;
const learning = readLearningState();
let selectedCourse = null;
let selectedLab = null;
let labEngine = null;
let labCommands = [];
let hintIndex = 0;

const $ = id => document.getElementById(id);

function statCard(value,label) {
  const el = document.createElement('div');
  el.className = 'stat-card';
  const strong = document.createElement('strong'); strong.textContent = value;
  const span = document.createElement('span'); span.textContent = label;
  el.append(strong,span);
  return el;
}

function renderCourseStats() {
  const root = $('courseStats');
  if (!root) return;
  const lessonTotal = COURSES.reduce((sum,course) => sum + course.lessons.length,0);
  const completed = learning.completedLessons.length;
  const progress = getProgressSummary();
  root.replaceChildren(
    statCard(`${completed}/${lessonTotal}`,'Lessons completed'),
    statCard(COURSES.length,'Learning tracks'),
    statCard(progress.xp,'Total XP'),
    statCard(progress.level,'Current level')
  );
}

function renderCourses() {
  const grid = $('courseGrid');
  if (!grid) return;
  grid.replaceChildren();
  COURSES.forEach(course => {
    const progress = getCourseProgress(course, learning);
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-card-meta"><span>${course.level}</span><span>${course.duration}</span><span>${course.xp} XP</span></div>
      <div class="feature-icon"><i class="fas ${course.icon}"></i></div>
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <div class="course-progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>
      <small style="color:var(--muted);margin-bottom:16px">${progress.done}/${progress.total} lessons complete</small>`;
    const button = document.createElement('button');
    button.className = 'button primary';
    button.type = 'button';
    button.textContent = progress.done ? 'Continue course' : 'Start course';
    button.addEventListener('click', () => openCourse(course.id));
    card.appendChild(button);
    grid.appendChild(card);
  });
}

function openCourse(courseId) {
  selectedCourse = COURSES.find(course => course.id === courseId);
  if (!selectedCourse) return;
  $('courseWorkspace').hidden = false;
  renderCourseDetail();
  renderCourseQuiz();
  $('courseWorkspace').scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderCourseDetail() {
  const root = $('courseDetail');
  const side = $('courseProgressSide');
  if (!root || !side || !selectedCourse) return;
  const progress = getCourseProgress(selectedCourse, learning);
  root.replaceChildren();

  const header = document.createElement('div');
  header.innerHTML = `<div class="eyebrow">${selectedCourse.level} track</div><h2 style="margin:0 0 10px">${selectedCourse.title}</h2><p style="color:var(--muted);line-height:1.75">${selectedCourse.description}</p>`;
  const list = document.createElement('div');
  list.className = 'lesson-list';
  selectedCourse.lessons.forEach((lesson,index) => {
    const key = `${selectedCourse.id}:${lesson.id}`;
    const done = learning.completedLessons.includes(key);
    const row = document.createElement('div');
    row.className = `lesson-row ${done ? 'done' : ''}`;
    const number = document.createElement('span'); number.className='lesson-index'; number.textContent = done ? '✓' : index + 1;
    const text = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = lesson.title;
    const summary = document.createElement('small'); summary.textContent = `${lesson.minutes} min • ${lesson.summary}`;
    text.append(title,document.createElement('br'),summary);
    const button = document.createElement('button'); button.className='button'; button.type='button'; button.textContent = done ? 'Completed' : 'Complete';
    button.disabled = done;
    button.addEventListener('click', () => completeLesson(key, lesson));
    row.append(number,text,button);
    list.appendChild(row);
  });
  root.append(header,list);

  side.innerHTML = `<strong style="font-size:2.3rem">${progress.percent}%</strong><p style="color:var(--muted)">${progress.done} of ${progress.total} lessons complete</p><div class="course-progress"><span style="width:${progress.percent}%"></span></div><p style="color:var(--muted);font-size:.88rem">Course reward: ${selectedCourse.xp} XP across lessons and quiz work.</p>`;
}

function completeLesson(key, lesson) {
  if (learning.completedLessons.includes(key)) return;
  learning.completedLessons.push(key);
  writeLearningState(learning);
  awardXP(35, `Lesson: ${lesson.title}`, { lesson:true });
  renderCourseStats();
  renderCourses();
  renderCourseDetail();
}

function renderCourseQuiz() {
  const root = $('quizPanel');
  if (!root || !selectedCourse) return;
  root.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Quick knowledge check';
  const p = document.createElement('p'); p.style.color='var(--muted)'; p.textContent='Answer all three. You can retake the quiz and your best score is saved.';
  root.append(h,p);
  const form = document.createElement('form');
  selectedCourse.quiz.forEach((item,qIndex) => {
    const field = document.createElement('fieldset');
    field.style.cssText='border:0;padding:14px 0;margin:0';
    const legend = document.createElement('legend'); legend.style.cssText='font-weight:700;margin-bottom:10px'; legend.textContent=`${qIndex + 1}. ${item.q}`;
    field.appendChild(legend);
    item.options.forEach((option,oIndex) => {
      const label = document.createElement('label');
      label.style.cssText='display:flex;gap:9px;align-items:flex-start;padding:8px 0;color:var(--muted);cursor:pointer';
      const radio = document.createElement('input'); radio.type='radio'; radio.name=`q${qIndex}`; radio.value=String(oIndex);
      label.append(radio,document.createTextNode(option)); field.appendChild(label);
    });
    form.appendChild(field);
  });
  const submit = document.createElement('button'); submit.className='button primary'; submit.type='submit'; submit.textContent='Check answers';
  const result = document.createElement('div'); result.className='tool-result'; result.hidden=true;
  form.append(submit,result);
  form.addEventListener('submit', event => {
    event.preventDefault();
    let score = 0;
    let answered = 0;
    selectedCourse.quiz.forEach((item,index) => {
      const value = form.elements[`q${index}`]?.value;
      if (value !== undefined && value !== '') { answered += 1; if (Number(value) === item.answer) score += 1; }
    });
    if (answered < selectedCourse.quiz.length) {
      result.hidden=false; result.textContent='Answer every question before checking your score.'; return;
    }
    const percent = Math.round((score / selectedCourse.quiz.length) * 100);
    const previous = Number(learning.quizScores[selectedCourse.id] || 0);
    learning.quizScores[selectedCourse.id] = Math.max(previous, percent);
    writeLearningState(learning);
    if (percent > previous) awardXP(Math.max(10, Math.round(percent / 4)), `Quiz: ${selectedCourse.title}`);
    result.hidden=false;
    result.textContent = `${score}/${selectedCourse.quiz.length} correct (${percent}%). ${percent >= 67 ? 'Good work — keep practicing the commands.' : 'Review the lessons and try again.'}`;
    renderCourseStats();
  });
  root.appendChild(form);
}

function renderLabStats() {
  const root = $('labStats');
  if (!root) return;
  const completed = learning.completedLabs.length;
  const progress = getProgressSummary();
  root.replaceChildren(
    statCard(`${completed}/${LABS.length}`,'Labs completed'),
    statCard(LABS.filter(lab => lab.difficulty === 'Beginner').length,'Beginner labs'),
    statCard(LABS.filter(lab => lab.difficulty === 'Intermediate').length,'Intermediate labs'),
    statCard(progress.xp,'Total XP')
  );
}

function renderLabs() {
  const grid = $('labGrid');
  if (!grid) return;
  grid.replaceChildren();
  LABS.forEach(lab => {
    const done = learning.completedLabs.includes(lab.id);
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `<div class="product-card-meta"><span>${lab.difficulty}</span><span>${lab.xp} XP</span>${done ? '<span>Completed ✓</span>' : ''}</div><div class="feature-icon"><i class="fas ${lab.icon}"></i></div><h3>${lab.title}</h3><p>${lab.scenario}</p>`;
    const button = document.createElement('button'); button.className='button primary'; button.type='button'; button.textContent=done?'Run again':'Start lab';
    button.addEventListener('click', () => openLab(lab.id));
    card.appendChild(button); grid.appendChild(card);
  });
}

function openLab(labId) {
  selectedLab = LABS.find(lab => lab.id === labId);
  if (!selectedLab) return;
  labEngine = createTerminalEngine();
  labCommands = [];
  hintIndex = 0;
  $('labWorkspace').hidden=false;
  $('labBrief').innerHTML = `<div class="eyebrow">${selectedLab.difficulty} lab • ${selectedLab.xp} XP</div><h2 style="margin:0 0 10px">${selectedLab.title}</h2><p style="color:var(--muted);line-height:1.8">${selectedLab.scenario}</p>`;
  $('labObjective').textContent=selectedLab.objective;
  $('labHint').textContent='Hints appear here without giving away the entire answer.';
  $('labTerminalOutput').textContent='LinuxAid Lab Terminal ready. Inspect first, change second, verify last.';
  $('labTerminalInput').value='';
  const askLink=$('askLabAi');
  if(askLink){
    const prompt=`I am working on the LinuxAid lab “${selectedLab.title}”. Scenario: ${selectedLab.scenario} Objective: ${selectedLab.objective} Give me one troubleshooting hint at a time without giving away the full solution.`;
    askLink.href=`dashboard.html?mode=troubleshoot&ask=${encodeURIComponent(prompt)}#assistant`;
  }
  $('labWorkspace').scrollIntoView({ behavior:'smooth', block:'start' });
  $('labTerminalInput').focus();
}

function runLabCommand(raw) {
  if (!selectedLab || !labEngine) return;
  const command = raw.trim();
  if (!command) return;
  const result = labEngine.execute(command);
  labCommands.push(result.command);
  const output = $('labTerminalOutput');
  output.textContent += `\n\n$ ${command}\n${result.output || ''}`;
  output.scrollTop=output.scrollHeight;
}

function checkLab() {
  if (!selectedLab) return;
  const used = new Set(labCommands);
  const missing = selectedLab.expected.filter(command => !used.has(command));
  if (missing.length) {
    $('labHint').textContent = `Not complete yet. Your workflow still needs: ${missing.join(', ')}. Think about what each missing command proves or changes.`;
    return;
  }
  const first = !learning.completedLabs.includes(selectedLab.id);
  if (first) {
    learning.completedLabs.push(selectedLab.id);
    writeLearningState(learning);
    awardXP(selectedLab.xp, `Lab: ${selectedLab.title}`, { lab:true });
  }
  $('labHint').textContent = first ? `Lab complete ✓ You earned ${selectedLab.xp} XP.` : 'Lab complete ✓ You already earned the XP for this challenge, but rerunning it is great practice.';
  renderLabStats();
  renderLabs();
}

function initLabs() {
  renderLabStats(); renderLabs();
  $('labTerminalForm')?.addEventListener('submit', event => { event.preventDefault(); runLabCommand($('labTerminalInput').value); $('labTerminalInput').value=''; });
  $('showHint')?.addEventListener('click', () => {
    if (!selectedLab) return;
    const hint = selectedLab.hints[Math.min(hintIndex, selectedLab.hints.length - 1)];
    $('labHint').textContent=hint;
    hintIndex += 1;
  });
  $('checkLab')?.addEventListener('click', checkLab);
}

if (page === 'courses') { renderCourseStats(); renderCourses(); }
if (page === 'labs') initLabs();
