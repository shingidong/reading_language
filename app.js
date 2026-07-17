// ============================================
// 병목 문장 독해 실험 — 실행 로직 (v6)
// ============================================
// 개인 내 2요인 무작위 배정:
//   · 병목수준(상/중/하) — 명제별 무작위
//   · 읽기조건(자유/제한) — 명제별 무작위. 제한=음절수 비례 시간 뒤 자동 넘김.
// 부실 응답 차단: 최소 읽기시간 게이트 + 주의점검 문항.
// 흐름: [지문1 읽기 → 지문1 문항] → [지문2 읽기 → 지문2 문항] → 제출
// ============================================

const $ = (id) => document.getElementById(id);

const state = {
  session: null,
  order: [],
  pIdx: 0,
  unitLevel: {},   // "pid#uid" → 'low'|'mid'|'high'
  unitTime: {},    // "pid#uid" → 'free'|'limited'

  plan: [],
  idx: 0,
  enterTime: null,
  canAdvance: false,       // 최소 읽기시간 게이트 통과 여부
  advanceTimer: null,      // 제한 조건 자동 넘김 타이머
  gateTimer: null,         // 최소 읽기시간 타이머
  autoFlag: {},            // "pid#uid" → 자동 넘김 여부

  visits: {},
  dwell: {},
  allPerUnit: [],
  allEvents: [],
  allQuiz: [],

  quizList: [],
  answers: {},
  confidences: {},
  quizStart: null,
  responseTimes: {},
  submitting: false,
};

const keyOf = (item) => `${item.passageId}#${item.unitId}`;

function showScreen(name) {
  ['start', 'read', 'quiz', 'done'].forEach(s => { $(`screen-${s}`).hidden = (s !== name); });
  window.scrollTo(0, 0);
}

// ══════════ 1. 시작 ══════════

$('btn-start').addEventListener('click', () => {
  const pid = $('pid').value.trim();
  const grade = $('grade').value;
  const prior = $('prior').value;
  const err = $('start-err');
  const fail = (msg) => { err.textContent = msg; err.hidden = false; };

  if (!pid) return fail('학번과 이름을 입력해주세요.');
  if (!grade) return fail('국어 등급을 선택해주세요.');
  if (prior === '') return fail('배경지식 정도를 선택해주세요.');
  err.hidden = true;

  state.order = orderedPassages();

  // 명제별로 병목수준·읽기조건을 각각 무작위 배정 (읽기 순서대로 10개)
  const flat = [];
  state.order.forEach(p => p.units.forEach(u => flat.push(`${p.id}#${u.id}`)));
  const levels = assignPropositionLevels(flat.length);
  const times = assignTimeConditions(flat.length);
  state.unitLevel = {}; state.unitTime = {};
  flat.forEach((k, i) => { state.unitLevel[k] = levels[i]; state.unitTime[k] = times[i]; });

  state.session = {
    pid, grade, priorKnowledge: parseInt(prior, 10),
    assignMethod: 'random-2factor',
    assignment: state.unitLevel,
    timeAssignment: state.unitTime,
    passageOrder: state.order.map(p => p.id),
    startedAt: new Date().toISOString(),
  };

  state.pIdx = 0;
  state.allPerUnit = []; state.allEvents = []; state.allQuiz = [];
  startPassageReading();
});

// ══════════ 2. 읽기 (시간제한·게이트 지원) ══════════

function startPassageReading() {
  const p = state.order[state.pIdx];
  state.plan = p.units.map(u => {
    const key = `${p.id}#${u.id}`;
    const level = state.unitLevel[key];
    const cond = state.unitTime[key];
    const v = u.versions[level];
    return {
      passageId: p.id, passageTitle: p.title, unitId: u.id, topic: u.topic,
      level, levelLabel: LEVEL_LABEL[level],
      timeCondition: cond,
      timeLimitMs: cond === 'limited' ? timeLimitFor(v.syllables) : null,
      minReadMs: minReadFor(v.syllables),
      text: v.text, score: v.score, raw: v.raw,
      features: v.features, syllables: v.syllables, words: v.words,
    };
  });
  state.idx = 0;
  showScreen('read');
  enterUnit();
  window.addEventListener('keydown', readKeyHandler);
}

function clearTimers() {
  if (state.advanceTimer) { clearTimeout(state.advanceTimer); state.advanceTimer = null; }
  if (state.gateTimer) { clearTimeout(state.gateTimer); state.gateTimer = null; }
}

function enterUnit() {
  clearTimers();
  const item = state.plan[state.idx];
  const k = keyOf(item);
  state.visits[k] = (state.visits[k] || 0) + 1;
  state.enterTime = performance.now();
  state.canAdvance = false;
  renderUnit();

  // 최소 읽기시간 게이트: 이 시간 전에는 다음으로 못 넘어감
  $('btn-next').disabled = true;
  state.gateTimer = setTimeout(() => {
    state.canAdvance = true;
    $('btn-next').disabled = false;
  }, item.minReadMs);

  // 제한 조건: 시간이 지나면 자동으로 다음 명제로
  if (item.timeCondition === 'limited') {
    startTimerBar(item.timeLimitMs);
    state.advanceTimer = setTimeout(() => {
      state.autoFlag[k] = true;
      advance('timeout');
    }, item.timeLimitMs);
  } else {
    stopTimerBar();
  }
}

function renderUnit() {
  const total = state.plan.length;
  const i = state.idx;
  const item = state.plan[i];
  const limited = item.timeCondition === 'limited';

  $('read-passage').textContent = `${item.passageTitle}  (지문 ${state.pIdx + 1} / 2)`;
  $('read-cond').innerHTML = limited
    ? '<span class="cond-limited">⏱ 시간제한 — 시간이 지나면 자동으로 넘어갑니다</span>'
    : '<span class="cond-free">자유 읽기 — 이해되면 넘기세요</span>';
  $('sentence').textContent = item.text;
  $('read-counter').textContent = `${i + 1} / ${total}`;
  $('read-fill').style.width = `${((i + 1) / total) * 100}%`;
  $('btn-next').textContent = (i < total - 1) ? '다음 →' : '문제 풀기 →';
  $('read-timer').hidden = !limited;
}

// 제한 조건 카운트다운 바
function startTimerBar(ms) {
  const bar = $('timer-fill');
  $('read-timer').hidden = false;
  bar.style.transition = 'none';
  bar.style.width = '100%';
  // 리플로우 강제 후 트랜지션 시작
  void bar.offsetWidth;
  bar.style.transition = `width ${ms}ms linear`;
  bar.style.width = '0%';
}
function stopTimerBar() {
  const bar = $('timer-fill');
  bar.style.transition = 'none';
  bar.style.width = '0%';
  $('read-timer').hidden = true;
}

function recordExit(direction) {
  if (state.enterTime == null) return;
  const item = state.plan[state.idx];
  const k = keyOf(item);
  const ms = Math.round(performance.now() - state.enterTime);
  state.dwell[k] = (state.dwell[k] || 0) + ms;
  state.allEvents.push({
    passageId: item.passageId, unitId: item.unitId, level: item.level,
    timeCondition: item.timeCondition, bottleneckScore: item.score,
    dwellMs: ms, direction, timestamp: Date.now(),
  });
}

// 다음으로 진행 (버튼/스페이스='next', 자동='timeout')
function advance(direction) {
  clearTimers();
  const total = state.plan.length;
  if (state.idx < total - 1) {
    recordExit(direction);
    state.idx++;
    enterUnit();
  } else {
    recordExit(direction === 'timeout' ? 'timeout' : 'finish');
    finishPassageReading();
  }
}

function readKeyHandler(e) {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
    e.preventDefault();
    if (state.canAdvance) advance('next');
  }
}
$('btn-next').addEventListener('click', () => { if (state.canAdvance) advance('next'); });

function finishPassageReading() {
  clearTimers();
  stopTimerBar();
  state.plan.forEach(item => {
    const k = keyOf(item);
    const totalMs = state.dwell[k] || 0;
    state.allPerUnit.push({
      passageId: item.passageId, passageTitle: item.passageTitle,
      unitId: item.unitId, topic: item.topic,
      level: item.level, levelLabel: item.levelLabel,
      timeCondition: item.timeCondition,
      timeLimitMs: item.timeLimitMs,
      autoAdvanced: !!state.autoFlag[k],
      bottleneckScore: item.score, bottleneckRaw: item.raw,
      embeds: item.features.embeds, nominal: item.features.nominal, passive: item.features.passive,
      clauseDensity: Math.round((item.features.clauses / item.features.sentences) * 100) / 100,
      syllables: item.syllables, words: item.words,
      totalDwellMs: totalMs,
      msPerWord: item.words ? Math.round((totalMs / item.words) * 10) / 10 : null,
      msPerSyllable: item.syllables ? Math.round((totalMs / item.syllables) * 10) / 10 : null,
      visits: state.visits[k] || 1,
      rereads: Math.max(0, (state.visits[k] || 1) - 1),
    });
  });
  window.removeEventListener('keydown', readKeyHandler);
  startPassageQuiz();
}

// ══════════ 3. 이해 문항 (+ 주의점검) ══════════

function startPassageQuiz() {
  const p = state.order[state.pIdx];
  state.quizList = p.questions.map(q => Object.assign({ passageId: p.id, passageTitle: p.title }, q));

  const list = $('quiz-list');
  list.innerHTML = '';
  const h = document.createElement('h2');
  h.className = 'quiz-section';
  h.textContent = `${p.title}  —  이해 문항`;
  list.appendChild(h);

  state.quizList.forEach((q, qi) => {
    const isAtt = q.type === 'attention';
    const card = document.createElement('div');
    card.className = 'card' + (isAtt ? ' att-card' : '');

    const idxLine = document.createElement('div');
    idxLine.className = 'q-index';
    idxLine.textContent = isAtt ? '확인 문항' : `문항 ${qi + 1} / ${state.quizList.length - 1}`;
    card.appendChild(idxLine);

    const title = document.createElement('h3');
    title.className = 'q-text';
    title.textContent = q.text;
    card.appendChild(title);

    const opts = document.createElement('div');
    opts.className = 'question-options';
    q.options.forEach((opt, oi) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = q.id;
      radio.addEventListener('change', () => selectAnswer(q.id, oi));
      const span = document.createElement('span');
      span.textContent = opt;
      label.appendChild(radio); label.appendChild(span);
      opts.appendChild(label);
    });
    card.appendChild(opts);

    // 주의점검은 확신도를 묻지 않는다
    if (!isAtt) {
      const confBlock = document.createElement('div');
      confBlock.className = 'confidence-block';
      const confLabel = document.createElement('label');
      confLabel.className = 'confidence-label';
      confLabel.textContent = '이 답을 얼마나 확신하나요?';
      confBlock.appendChild(confLabel);
      const confRow = document.createElement('div');
      confRow.className = 'confidence-row';
      confidenceOptions.forEach(c => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = `conf_${q.id}`;
        radio.addEventListener('change', () => { state.confidences[q.id] = c.value; });
        const span = document.createElement('span'); span.textContent = c.label;
        label.appendChild(radio); label.appendChild(span);
        confRow.appendChild(label);
      });
      confBlock.appendChild(confRow);
      card.appendChild(confBlock);
    }
    list.appendChild(card);
  });

  const isLast = (state.pIdx === state.order.length - 1);
  $('btn-submit').textContent = isLast ? '제출하기' : '다음 지문 읽기 →';
  $('btn-submit').disabled = false;
  state.quizStart = performance.now();
  showScreen('quiz');
}

function selectAnswer(qid, optIdx) {
  if (state.answers[qid] === undefined) {
    state.responseTimes[qid] = Math.round(performance.now() - state.quizStart);
  }
  state.answers[qid] = optIdx;
}

$('btn-submit').addEventListener('click', onQuizNext);

async function onQuizNext() {
  if (state.submitting) return;
  const err = $('quiz-err');
  const missing = [];
  state.quizList.forEach(q => {
    if (state.answers[q.id] === undefined) missing.push(`${q.id} 답`);
    if (q.type !== 'attention' && !state.confidences[q.id]) missing.push(`${q.id} 확신도`);
  });
  if (missing.length > 0) {
    err.textContent = `아직 응답하지 않은 항목이 있습니다: ${missing.slice(0, 3).join(', ')} 등`;
    err.hidden = false;
    return;
  }
  err.hidden = true;

  const unitByKey = {};
  state.allPerUnit.forEach(u => { unitByKey[`${u.passageId}#${u.unitId}`] = u; });

  state.quizList.forEach(q => {
    if (q.type === 'attention') {
      state.allQuiz.push({
        qid: q.id, passageId: q.passageId, type: 'attention', sourceUnit: null,
        chosen: state.answers[q.id], correct: state.answers[q.id] === q.answer,
      });
      return;
    }
    const src = unitByKey[`${q.passageId}#${q.sourceUnit}`];
    const chosen = state.answers[q.id];
    const correct = chosen === q.answer;
    const confidence = state.confidences[q.id];
    state.allQuiz.push({
      qid: q.id, passageId: q.passageId, type: q.type, sourceUnit: q.sourceUnit,
      level: src.level, levelLabel: src.levelLabel, bottleneckScore: src.bottleneckScore,
      srcTimeCondition: src.timeCondition, srcAutoAdvanced: src.autoAdvanced,
      srcTotalMs: src.totalDwellMs, srcMsPerWord: src.msPerWord, srcRereads: src.rereads,
      chosen, correct, confidence,
      responseMs: state.responseTimes[q.id] ?? null,
      illusion: !correct && confidence === 'sure',
      trueUnderstanding: correct && confidence === 'sure',
      luckyGuess: correct && confidence === 'guess',
    });
  });

  if (state.pIdx < state.order.length - 1) {
    state.pIdx++;
    startPassageReading();
  } else {
    await finalizeAndSubmit();
  }
}

async function finalizeAndSubmit() {
  state.submitting = true;
  $('btn-submit').disabled = true;
  $('btn-submit').textContent = '전송 중...';
  const err = $('quiz-err');
  const finalData = buildFinalData();

  try {
    const backup = JSON.parse(localStorage.getItem('exp_backup') || '[]');
    backup.push(finalData);
    localStorage.setItem('exp_backup', JSON.stringify(backup));
  } catch (e) { /* 무시 */ }

  try {
    await sendToSheets(finalData);
  } catch (e) {
    console.error('[전송 실패]', e);
    err.textContent = '데이터 전송에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
    err.hidden = false;
    state.submitting = false;
    $('btn-submit').disabled = false;
    $('btn-submit').textContent = '다시 제출하기';
    return;
  }
  renderDone(finalData);
  showScreen('done');
}

function buildFinalData() {
  const comp = state.allQuiz.filter(r => r.type !== 'attention');   // 이해 문항
  const att = state.allQuiz.filter(r => r.type === 'attention');    // 주의점검
  const perUnit = state.allPerUnit;
  const attentionPassed = att.every(r => r.correct);

  const scoreByType = { recall: 0, integration: 0, inference: 0 };
  const countByType = { recall: 0, integration: 0, inference: 0 };
  comp.forEach(r => { countByType[r.type]++; if (r.correct) scoreByType[r.type]++; });

  // 시간조건별 정답률 (핵심 신규 분석)
  const byTime = {};
  ['free', 'limited'].forEach(c => {
    const qs = comp.filter(r => r.srcTimeCondition === c);
    byTime[c] = { n: qs.length, correct: qs.filter(r => r.correct).length,
      accuracy: qs.length ? Math.round(qs.filter(r => r.correct).length / qs.length * 100) : null };
  });

  const byPassage = {};
  perUnit.forEach(u => {
    const b = byPassage[u.passageId] || (byPassage[u.passageId] = { title: u.passageTitle, msSum: 0, wordSum: 0 });
    b.msSum += u.totalDwellMs; b.wordSum += u.words;
  });
  Object.keys(byPassage).forEach(pid => {
    const b = byPassage[pid];
    const qsP = comp.filter(r => r.passageId === pid);
    b.totalMs = b.msSum;
    b.msPerWord = b.wordSum ? Math.round(b.msSum / b.wordSum * 10) / 10 : null;
    b.correct = qsP.filter(r => r.correct).length; b.total = qsP.length;
    delete b.msSum; delete b.wordSum;
  });

  return {
    session: Object.assign({}, state.session, { attentionPassed, attentionCorrect: att.filter(r => r.correct).length, attentionTotal: att.length }),
    reading: { perUnit, events: state.allEvents, finishedAt: new Date().toISOString() },
    quiz: comp,
    attention: att,
    summary: {
      totalCorrect: comp.filter(r => r.correct).length,
      totalQuestions: comp.length,
      assignMethod: 'random-2factor',
      attentionPassed,
      meanBottleneck: round1(avg(perUnit.map(u => u.bottleneckScore))),
      meanMsPerWord: round1(avg(perUnit.map(u => u.msPerWord))),
      meanTotalMs: Math.round(avg(perUnit.map(u => u.totalDwellMs))),
      scoreByType, countByType, byTime, byPassage,
      illusionCount: comp.filter(r => r.illusion).length,
      trueUnderstandingCount: comp.filter(r => r.trueUnderstanding).length,
      luckyGuessCount: comp.filter(r => r.luckyGuess).length,
    },
    submittedAt: new Date().toISOString(),
  };
}
function avg(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
function round1(x) { return Math.round(x * 10) / 10; }

async function sendToSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn('[경고] SHEETS_WEBHOOK_URL이 비어 있습니다. 콘솔에만 기록합니다.');
    console.log('[제출 데이터]', payload);
    return;
  }
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn('[일반 전송 실패, no-cors로 재시도]', e);
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body,
    });
  }
}

// ══════════ 4. 완료 ══════════

function renderDone(data) {
  const { summary, session } = data;
  const scorePct = Math.round((summary.totalCorrect / summary.totalQuestions) * 100);
  const bt = summary.byTime;

  const rows = data.reading.perUnit
    .slice().sort((a, b) => a.bottleneckScore - b.bottleneckScore)
    .map(u => {
      const qs = data.quiz.filter(q => q.passageId === u.passageId && q.sourceUnit === u.unitId);
      const acc = qs.length ? `${qs.filter(q => q.correct).length}/${qs.length}` : '-';
      return `<tr>
        <td>${u.passageTitle}</td><td>${u.topic}</td>
        <td class="num">${u.levelLabel}</td><td class="num">${u.bottleneckScore}</td>
        <td class="num">${u.timeCondition === 'limited' ? '제한' : '자유'}</td>
        <td class="num">${(u.totalDwellMs / 1000).toFixed(1)}</td>
        <td class="num">${acc}</td>
      </tr>`;
    }).join('');

  const attNote = session.attentionPassed
    ? ''
    : `<div class="hint" style="margin-top:16px;border-left-color:#b26b1e">주의점검 문항을 놓치셨습니다. 데이터 분석 시 참고됩니다.</div>`;

  $('done-body').innerHTML = `
    <div class="card">
      <h2>당신의 결과</h2>
      <p>문장 난이도와 읽기 시간(자유/제한)이 <strong>무작위로 섞여</strong> 제시되었습니다
         (평균 병목 ${summary.meanBottleneck}/10).</p>
      <p>전체 정답률: <strong>${summary.totalCorrect} / ${summary.totalQuestions} (${scorePct}%)</strong></p>
      <p>읽기 조건별 정답률 —
         자유 <strong>${bt.free.accuracy ?? '-'}%</strong> ·
         시간제한 <strong>${bt.limited.accuracy ?? '-'}%</strong></p>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>지문</th><th>내용</th><th class="num">난이도</th>
            <th class="num">병목</th><th class="num">읽기</th>
            <th class="num">시간(초)</th><th class="num">정답</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${attNote}
    </div>`;
}
