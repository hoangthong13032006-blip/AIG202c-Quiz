// AIG202c Quiz App - Full Logic
'use strict';

// ========== STATE ==========
const state = {
  mode: 'home',       // home | quiz | review | results | flashcard
  all: [...QUESTIONS],
  filtered: [],
  current: 0,
  score: 0,
  selected: [],
  answered: false,
  showAnswer: false,
  results: [],        // {q, selected, correct}
  quizType: 'all',    // all | single | multi
  shuffled: false,
  flashIndex: 0,
  flashFlipped: false,
  searchTerm: '',
  timer: null,
  timeLeft: 0,
  useTimer: false,
};

// ========== DOM REFS ==========
const el = id => document.getElementById(id);

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  initEventListeners();
});

function initEventListeners() {
  // Home buttons
  el('btn-start-all').addEventListener('click', () => startQuiz('all'));
  el('btn-start-single').addEventListener('click', () => startQuiz('single'));
  el('btn-start-multi').addEventListener('click', () => startQuiz('multi'));
  el('btn-flashcard').addEventListener('click', () => startFlashcard());
  el('btn-review-all').addEventListener('click', () => startReview());

  // Search
  el('search-input').addEventListener('input', e => {
    state.searchTerm = e.target.value.toLowerCase();
    renderQuestionList();
  });

  // Shuffle toggle
  el('btn-shuffle').addEventListener('click', () => {
    state.shuffled = !state.shuffled;
    el('btn-shuffle').classList.toggle('active', state.shuffled);
  });

  // Timer toggle
  el('btn-timer').addEventListener('click', () => {
    state.useTimer = !state.useTimer;
    el('btn-timer').classList.toggle('active', state.useTimer);
  });

  // Navigation
  el('btn-back').addEventListener('click', goBack);
  el('btn-home').addEventListener('click', showHome);
}

// ========== HOME ==========
function renderHome() {
  const total = QUESTIONS.length;
  const single = QUESTIONS.filter(q => q.type === 'single').length;
  const multi = QUESTIONS.filter(q => q.type === 'multi').length;

  el('stat-total').textContent = total;
  el('stat-single').textContent = single;
  el('stat-multi').textContent = multi;
  el('stat-slides').textContent = 178;

  renderQuestionList();
  showSection('home');
}

function renderQuestionList() {
  const list = el('question-list');
  const term = state.searchTerm;
  const questions = QUESTIONS.filter(q =>
    !term || q.q.toLowerCase().includes(term) || q.opts.some(o => o.toLowerCase().includes(term))
  );

  list.innerHTML = questions.map(q => `
    <div class="q-list-item" onclick="previewQuestion(${q.id})">
      <div class="q-list-num">Q${q.id} <span class="badge badge-${q.type}">${q.type === 'multi' ? 'Multi' : 'Single'}</span></div>
      <div class="q-list-text">${q.q.substring(0, 80)}${q.q.length > 80 ? '...' : ''}</div>
      <div class="q-list-ans">✓ ${getAnswerLetters(q)}</div>
    </div>
  `).join('');
}

function previewQuestion(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) return;
  const modal = el('preview-modal');
  el('preview-content').innerHTML = `
    <div class="preview-slide">Slide ${q.slide}</div>
    <div class="preview-type">${q.type === 'multi' ? '📋 Multi-answer' : '📌 Single answer'}</div>
    <h3 class="preview-q">${q.q}</h3>
    <div class="preview-opts">
      ${q.opts.map((o, i) => {
        const letter = String.fromCharCode(65 + i);
        const isAns = q.ans.includes(i);
        return `<div class="preview-opt ${isAns ? 'correct' : ''}">
          <span class="opt-letter">${letter}</span> ${o}
          ${isAns ? '<span class="tick">✓</span>' : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="preview-answer">Answer: <strong>${getAnswerLetters(q)}</strong></div>
  `;
  modal.classList.add('open');
}

el('preview-modal') && document.addEventListener('click', e => {
  if (e.target.id === 'preview-modal') el('preview-modal').classList.remove('open');
});

// ========== QUIZ ==========
function startQuiz(type) {
  state.quizType = type;
  state.results = [];
  state.score = 0;
  state.current = 0;

  if (type === 'all') state.filtered = [...QUESTIONS];
  else if (type === 'single') state.filtered = QUESTIONS.filter(q => q.type === 'single');
  else if (type === 'multi') state.filtered = QUESTIONS.filter(q => q.type === 'multi');

  if (state.shuffled) {
    state.filtered = [...state.filtered].sort(() => Math.random() - 0.5);
  }

  state.mode = 'quiz';
  renderQuestion();
  showSection('quiz');
}

function renderQuestion() {
  const q = state.filtered[state.current];
  if (!q) return;

  state.selected = [];
  state.answered = false;

  // Update progress
  const total = state.filtered.length;
  const pct = ((state.current) / total) * 100;
  el('progress-bar').style.width = pct + '%';
  el('progress-text').textContent = `${state.current + 1} / ${total}`;
  el('score-display').textContent = `Score: ${state.score}/${state.current}`;

  // Slide & type info
  el('slide-badge').textContent = `Slide ${q.slide}`;
  el('type-badge').textContent = q.type === 'multi' ? `📋 Choose ${q.ans.length}` : '📌 Single';
  el('type-badge').className = `type-badge ${q.type}`;

  // Question
  el('question-text').textContent = q.q;

  // Options
  const optsEl = el('options-container');
  optsEl.innerHTML = q.opts.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `
      <div class="option" id="opt-${i}" onclick="selectOption(${i})">
        <div class="opt-letter-box">${letter}</div>
        <div class="opt-text">${opt}</div>
      </div>
    `;
  }).join('');

  // Buttons
  el('btn-check').style.display = 'flex';
  el('btn-next').style.display = 'none';
  el('feedback-area').style.display = 'none';

  // Timer
  if (state.useTimer) startTimer();
}

function selectOption(i) {
  if (state.answered) return;
  const q = state.filtered[state.current];

  if (q.type === 'single') {
    state.selected = [i];
    document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
    el(`opt-${i}`).classList.add('selected');
  } else {
    // multi
    const idx = state.selected.indexOf(i);
    if (idx === -1) {
      if (state.selected.length < q.ans.length) {
        state.selected.push(i);
        el(`opt-${i}`).classList.add('selected');
      }
    } else {
      state.selected.splice(idx, 1);
      el(`opt-${i}`).classList.remove('selected');
    }
  }
}

function checkAnswer() {
  if (state.selected.length === 0) {
    shakeEl(el('btn-check'));
    return;
  }

  const q = state.filtered[state.current];
  state.answered = true;

  if (state.useTimer) clearInterval(state.timer);

  const correct = arraysEqual(state.selected.sort(), q.ans.slice().sort());
  if (correct) state.score++;

  state.results.push({ q, selected: [...state.selected], correct });

  // Color options
  q.opts.forEach((_, i) => {
    const optEl = el(`opt-${i}`);
    if (q.ans.includes(i)) optEl.classList.add('correct');
    else if (state.selected.includes(i)) optEl.classList.add('wrong');
    optEl.classList.remove('selected');
  });

  // Feedback
  const fb = el('feedback-area');
  fb.style.display = 'flex';
  fb.className = `feedback-area ${correct ? 'fb-correct' : 'fb-wrong'}`;
  fb.innerHTML = correct
    ? `<span class="fb-icon">🎉</span><div><strong>Correct!</strong> Well done!</div>`
    : `<span class="fb-icon">❌</span><div><strong>Incorrect.</strong> Answer: <strong>${getAnswerLetters(q)}</strong> — ${getAnswerTexts(q).join('; ')}</div>`;

  el('btn-check').style.display = 'none';
  el('btn-next').style.display = 'flex';
}

function nextQuestion() {
  state.current++;
  if (state.current >= state.filtered.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

function startTimer() {
  state.timeLeft = 30;
  el('timer-display').style.display = 'block';
  el('timer-display').textContent = `⏱ ${state.timeLeft}s`;
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.timeLeft--;
    el('timer-display').textContent = `⏱ ${state.timeLeft}s`;
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      if (!state.answered) {
        state.selected = [];
        checkAnswer();
      }
    }
  }, 1000);
}

// ========== RESULTS ==========
function showResults() {
  const total = state.filtered.length;
  const pct = Math.round((state.score / total) * 100);
  const grade = pct >= 80 ? '🏆 Excellent!' : pct >= 60 ? '👍 Good Job!' : '📚 Keep Studying!';

  el('result-score').textContent = `${state.score} / ${total}`;
  el('result-pct').textContent = `${pct}%`;
  el('result-grade').textContent = grade;

  // Pie chart
  const correct = state.score;
  const wrong = total - correct;
  el('pie-correct').textContent = correct;
  el('pie-wrong').textContent = wrong;
  const deg = (correct / total) * 360;
  el('pie-chart').style.background =
    `conic-gradient(#22c55e ${deg}deg, #ef4444 ${deg}deg)`;

  // Breakdown
  const breakdown = el('results-breakdown');
  breakdown.innerHTML = state.results.map((r, idx) => {
    const letters = getAnswerLetters(r.q);
    const selectedLetters = r.selected.map(i => String.fromCharCode(65 + i)).join(', ');
    return `
      <div class="result-item ${r.correct ? 'r-correct' : 'r-wrong'}">
        <div class="r-header">
          <span class="r-num">Q${idx + 1}</span>
          <span class="r-status">${r.correct ? '✓ Correct' : '✗ Wrong'}</span>
        </div>
        <div class="r-q">${r.q}</div>
        <div class="r-detail">Your answer: <strong>${selectedLetters || '—'}</strong> | Correct: <strong>${letters}</strong></div>
      </div>
    `;
  }).join('');

  showSection('results');
}

// ========== REVIEW MODE ==========
function startReview() {
  state.filtered = [...QUESTIONS];
  state.current = 0;
  state.mode = 'review';
  renderReview();
  showSection('review');
}

function renderReview() {
  const q = state.filtered[state.current];
  const total = state.filtered.length;

  el('review-progress').textContent = `${state.current + 1} / ${total}`;
  el('review-slide').textContent = `Slide ${q.slide}`;
  el('review-type').textContent = q.type === 'multi' ? `📋 Multi (Choose ${q.ans.length})` : '📌 Single';

  el('review-question').textContent = q.q;

  const optsEl = el('review-options');
  optsEl.innerHTML = q.opts.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const isAns = q.ans.includes(i);
    return `<div class="review-opt ${isAns ? 'rev-correct' : ''}">
      <span class="rev-letter">${letter}</span>
      <span class="rev-text">${opt}</span>
      ${isAns ? '<span class="rev-tick">✓</span>' : ''}
    </div>`;
  }).join('');

  el('review-answer').textContent = `Answer: ${getAnswerLetters(q)} — ${getAnswerTexts(q).join(', ')}`;

  el('btn-rev-prev').disabled = state.current === 0;
  el('btn-rev-next').disabled = state.current === total - 1;

  const pct = ((state.current + 1) / total) * 100;
  el('review-progress-bar').style.width = pct + '%';
}

// ========== FLASHCARD MODE ==========
function startFlashcard() {
  state.filtered = [...QUESTIONS];
  if (state.shuffled) state.filtered.sort(() => Math.random() - 0.5);
  state.flashIndex = 0;
  state.flashFlipped = false;
  state.mode = 'flashcard';
  renderFlashcard();
  showSection('flashcard');
}

function renderFlashcard() {
  const q = state.filtered[state.flashIndex];
  const total = state.filtered.length;
  state.flashFlipped = false;

  el('flash-progress').textContent = `${state.flashIndex + 1} / ${total}`;
  el('flash-slide').textContent = `Slide ${q.slide}`;

  const card = el('flash-card');
  card.classList.remove('flipped');

  el('flash-front').innerHTML = `
    <div class="flash-qnum">Question ${state.flashIndex + 1}</div>
    <div class="flash-question">${q.q}</div>
    <div class="flash-hint">Click to reveal answer</div>
  `;

  const answerTexts = getAnswerTexts(q).map((t, i) => `<div class="flash-ans-item">${getAnswerLetters(q).split(', ')[i] || ''}: ${t}</div>`).join('');
  el('flash-back').innerHTML = `
    <div class="flash-ans-label">Answer: ${getAnswerLetters(q)}</div>
    ${answerTexts}
    <div class="flash-opts-list">
      ${q.opts.map((o, i) => {
        const letter = String.fromCharCode(65 + i);
        const isAns = q.ans.includes(i);
        return `<div class="flash-opt-row ${isAns ? 'flash-correct' : ''}">${letter}. ${o}</div>`;
      }).join('')}
    </div>
  `;

  el('btn-flash-prev').disabled = state.flashIndex === 0;
  el('btn-flash-next').disabled = state.flashIndex === total - 1;
}

function flipCard() {
  const card = el('flash-card');
  state.flashFlipped = !state.flashFlipped;
  card.classList.toggle('flipped', state.flashFlipped);
}

// ========== SECTION CONTROL ==========
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  el(`section-${name}`).classList.add('active');
  state.mode = name;
}

function showHome() {
  clearInterval(state.timer);
  renderHome();
}

function goBack() {
  clearInterval(state.timer);
  showHome();
}

// ========== EVENT DELEGATES ==========
document.addEventListener('click', e => {
  const t = e.target;

  // Quiz check
  if (t.id === 'btn-check') checkAnswer();
  if (t.id === 'btn-next') nextQuestion();

  // Results
  if (t.id === 'btn-retry') startQuiz(state.quizType);
  if (t.id === 'btn-results-home') showHome();

  // Review
  if (t.id === 'btn-rev-prev' && state.current > 0) { state.current--; renderReview(); }
  if (t.id === 'btn-rev-next' && state.current < state.filtered.length - 1) { state.current++; renderReview(); }
  if (t.id === 'btn-rev-home') showHome();

  // Flashcard
  if (t.id === 'flash-card' || t.closest('#flash-card')) {
    if (t.id === 'btn-flash-prev' || t.id === 'btn-flash-next') return;
    flipCard();
  }
  if (t.id === 'btn-flash-prev' && state.flashIndex > 0) { state.flashIndex--; renderFlashcard(); }
  if (t.id === 'btn-flash-next' && state.flashIndex < state.filtered.length - 1) { state.flashIndex++; renderFlashcard(); }
  if (t.id === 'btn-flash-home') showHome();

  // Preview modal close
  if (t.id === 'preview-close' || t.id === 'preview-modal') {
    el('preview-modal').classList.remove('open');
  }
});

// ========== KEYBOARD ==========
document.addEventListener('keydown', e => {
  if (state.mode === 'quiz') {
    const keyMap = {'1':0,'2':1,'3':2,'4':3,'5':4,'a':0,'b':1,'c':2,'d':3,'e':4};
    if (keyMap[e.key.toLowerCase()] !== undefined && !state.answered) {
      selectOption(keyMap[e.key.toLowerCase()]);
    }
    if (e.key === 'Enter') {
      if (!state.answered) checkAnswer();
      else nextQuestion();
    }
  }
  if (state.mode === 'flashcard' && e.key === ' ') { e.preventDefault(); flipCard(); }
  if (state.mode === 'flashcard' && e.key === 'ArrowLeft') {
    if (state.flashIndex > 0) { state.flashIndex--; renderFlashcard(); }
  }
  if (state.mode === 'flashcard' && e.key === 'ArrowRight') {
    if (state.flashIndex < state.filtered.length - 1) { state.flashIndex++; renderFlashcard(); }
  }
  if (state.mode === 'review' && e.key === 'ArrowLeft') {
    if (state.current > 0) { state.current--; renderReview(); }
  }
  if (state.mode === 'review' && e.key === 'ArrowRight') {
    if (state.current < state.filtered.length - 1) { state.current++; renderReview(); }
  }
  if (e.key === 'Escape') {
    el('preview-modal').classList.remove('open');
  }
});

// ========== UTILS ==========
function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function shakeEl(el) {
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
