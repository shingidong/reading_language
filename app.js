// ============================================
// 병목 문장 독해 실험 — 실행 로직
// ============================================
// 설계: 참가자가 난이도(상/중/하)를 직접 선택 → 그 수준으로 진행.
//   흐름: [지문1 읽기 → 지문1 문제] → [지문2 읽기 → 지문2 문제] → 완료
//   지문 제시 순서는 무작위(순서 효과 상쇄).
// 측정: 명제별 읽기 시간(음절당 정규화) + 명제별 이해 정확도 + 확신도.
// 분석 단위: 참가자 × 명제 (한 명이 명제 10개를 읽고 문항 6개를 푼다).
// ============================================

const $ = (id) => document.getElementById(id);

const state = {
  session: null,
  order: [],          // 무작위 순서의 지문 2개
  pIdx: 0,            // 현재 지문 인덱스 (0 → 1)
  chosenLevel: null,

  // 현재 지문 읽기용
  plan: [],           // 현재 지문의 명제들
  idx: 0,
  enterTime: null,
  visits: {},         // key: "passageId#unitId"
  dwell: {},

  // 전체 누적
  allPerUnit: [],
  allEvents: [],
  allQuiz: [],

  // 현재 지문 문항용
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

// ══════════ 1. 시작 화면 ══════════

$('btn-start').addEventListener('click', () => {
  const pid = $('pid').value.trim();
  const grade = $('grade').value;
  const prior = $('prior').value;
  const level = document.querySelector('input[name="level"]:checked');
  const err = $('start-err');
  const fail = (msg) => { err.textContent = msg; err.hidden = false; };

  if (!pid) return fail('학번과 이름을 입력해주세요.');
  if (!grade) return fail('국어 등급을 선택해주세요.');
  if (prior === '') return fail('배경지식 정도를 선택해주세요.');
  if (!level) return fail('읽을 난이도를 선택해주세요.');
  err.hidden = true;

  state.chosenLevel = level.value;
  state.order = orderedPassages();

  state.session = {
    pid,
    grade,
    priorKnowledge: parseInt(prior, 10),
    chosenLevel: state.chosenLevel,
    chosenLevelLabel: LEVEL_LABEL[state.chosenLevel],
    passageOrder: state.order.map(p => p.id),
    startedAt: new Date().toISOString(),
  };

  state.pIdx = 0;
  state.allPerUnit = [];
  state.allEvents = [];
  state.allQuiz = [];
  startPassageReading();
});

// ══════════ 2. 읽기 화면 (현재 지문) ══════════

function startPassageReading() {
  const p = state.order[state.pIdx];
  state.plan = p.units.map(u => {
    const v = u.versions[state.chosenLevel];
    return {
      passageId: p.id, passageTitle: p.title,
      unitId: u.id, topic: u.topic, level: state.chosenLevel,
      text: v.text, score: v.score, raw: v.raw,
      features: v.features, syllables: v.syllables, words: v.words,
    };
  });
  state.idx = 0;
  showScreen('read');
  enterUnit();
  window.addEventListener('keydown', readKeyHandler);
}

function enterUnit() {
  state.enterTime = performance.now();
  const k = keyOf(state.plan[state.idx]);
  state.visits[k] = (state.visits[k] || 0) + 1;
  renderUnit();
}

function recordExit(direction) {
  if (state.enterTime == null) return;
  const item = state.plan[state.idx];
  const k = keyOf(item);
  const ms = Math.round(performance.now() - state.enterTime);
  state.dwell[k] = (state.dwell[k] || 0) + ms;
  state.allEvents.push({
    passageId: item.passageId, unitId: item.unitId, level: item.level,
    bottleneckScore: item.score, dwellMs: ms, visit: state.visits[k] || 1,
    direction, timestamp: Date.now(),
  });
}

function renderUnit() {
  const total = state.plan.length;
  const i = state.idx;
  const item = state.plan[i];
  const k = keyOf(item);

  $('read-passage').textContent = `${item.passageTitle}  (지문 ${state.pIdx + 1} / 2)`;
  $('sentence').textContent = item.text;
  $('read-counter').textContent = `${i + 1} / ${total}`;
  $('read-revisit').innerHTML =
    (state.visits[k] || 0) > 1 ? '<span class="revisit-tag">· 재방문</span>' : '';
  $('read-fill').style.width = `${((i + 1) / total) * 100}%`;
  $('btn-prev').disabled = (i === 0);
  $('btn-next').textContent = (i < total - 1) ? '다음 →' : '문제 풀기 →';
}

function goNext() {
  const total = state.plan.length;
  if (state.idx < total - 1) {
    recordExit('next');
    state.idx++;
    enterUnit();
  } else {
    recordExit('finish');
    finishPassageReading();
  }
}

function goPrev() {
  if (state.idx > 0) {
    recordExit('prev');
    state.idx--;
    enterUnit();
  }
}

// 현재 지문의 명제별 측정치를 누적 테이블에 넣고 문항으로 이동
function finishPassageReading() {
  state.plan.forEach(item => {
    const k = keyOf(item);
    const totalMs = state.dwell[k] || 0;
    state.allPerUnit.push({
      passageId: item.passageId, passageTitle: item.passageTitle,
      unitId: item.unitId, topic: item.topic, level: item.level,
      bottleneckScore: item.score, bottleneckRaw: item.raw,
      embeds: item.features.embeds, nominal: item.features.nominal, passive: item.features.passive,
      clauseDensity: Math.round((item.features.clauses / item.features.sentences) * 100) / 100,
      syllables: item.syllables, words: item.words,
      totalDwellMs: totalMs,
      msPerSyllable: item.syllables ? Math.round((totalMs / item.syllables) * 10) / 10 : null,
      visits: state.visits[k] || 1,
      rereads: Math.max(0, (state.visits[k] || 1) - 1),
    });
  });
  window.removeEventListener('keydown', readKeyHandler);
  startPassageQuiz();
}

function readKeyHandler(e) {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
    e.preventDefault(); goNext();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault(); goPrev();
  }
}

$('btn-next').addEventListener('click', goNext);
$('btn-prev').addEventListener('click', goPrev);

// ══════════ 3. 이해 문항 화면 (현재 지문) ══════════

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
    const card = document.createElement('div');
    card.className = 'card';

    const idxLine = document.createElement('div');
    idxLine.className = 'q-index';
    idxLine.textContent = `문항 ${qi + 1} / ${state.quizList.length}`;
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
      radio.type = 'radio';
      radio.name = q.id;
      radio.addEventListener('change', () => selectAnswer(q.id, oi));
      const span = document.createElement('span');
      span.textContent = opt;
      label.appendChild(radio);
      label.appendChild(span);
      opts.appendChild(label);
    });
    card.appendChild(opts);

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
      radio.type = 'radio';
      radio.name = `conf_${q.id}`;
      radio.addEventListener('change', () => { state.confidences[q.id] = c.value; });
      const span = document.createElement('span');
      span.textContent = c.label;
      label.appendChild(radio);
      label.appendChild(span);
      confRow.appendChild(label);
    });
    confBlock.appendChild(confRow);
    card.appendChild(confBlock);

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
    if (!state.confidences[q.id]) missing.push(`${q.id} 확신도`);
  });
  if (missing.length > 0) {
    err.textContent = `아직 응답하지 않은 항목이 있습니다: ${missing.slice(0, 3).join(', ')} 등`;
    err.hidden = false;
    return;
  }
  err.hidden = true;

  // 현재 지문 문항 결과를 누적
  const unitByKey = {};
  state.allPerUnit.forEach(u => { unitByKey[`${u.passageId}#${u.unitId}`] = u; });
  state.quizList.forEach(q => {
    const src = unitByKey[`${q.passageId}#${q.sourceUnit}`];
    const chosen = state.answers[q.id];
    const correct = chosen === q.answer;
    const confidence = state.confidences[q.id];
    state.allQuiz.push({
      qid: q.id, passageId: q.passageId, type: q.type, sourceUnit: q.sourceUnit,
      level: src.level, bottleneckScore: src.bottleneckScore,
      srcMsPerSyllable: src.msPerSyllable, srcRereads: src.rereads,
      chosen, correct, confidence,
      responseMs: state.responseTimes[q.id] ?? null,
      illusion: !correct && confidence === 'sure',
      trueUnderstanding: correct && confidence === 'sure',
      luckyGuess: correct && confidence === 'guess',
    });
  });

  // 다음 지문이 남았으면 그 지문 읽기로, 아니면 최종 제출
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
  const quizResults = state.allQuiz;
  const perUnit = state.allPerUnit;

  const scoreByType = { recall: 0, integration: 0, inference: 0 };
  const countByType = { recall: 0, integration: 0, inference: 0 };
  quizResults.forEach(r => { countByType[r.type]++; if (r.correct) scoreByType[r.type]++; });

  const byPassage = {};
  perUnit.forEach(u => {
    const b = byPassage[u.passageId] || (byPassage[u.passageId] = { title: u.passageTitle, msSum: 0, sylSum: 0 });
    b.msSum += u.totalDwellMs; b.sylSum += u.syllables;
  });
  Object.keys(byPassage).forEach(pid => {
    const b = byPassage[pid];
    const qsP = quizResults.filter(r => r.passageId === pid);
    b.msPerSyllable = b.sylSum ? Math.round(b.msSum / b.sylSum * 10) / 10 : null;
    b.correct = qsP.filter(r => r.correct).length;
    b.total = qsP.length;
    delete b.msSum; delete b.sylSum;
  });

  return {
    session: state.session,
    reading: { perUnit, events: state.allEvents, finishedAt: new Date().toISOString() },
    quiz: quizResults,
    summary: {
      totalCorrect: quizResults.filter(r => r.correct).length,
      totalQuestions: quizResults.length,
      chosenLevel: state.chosenLevel,
      meanBottleneck: Math.round(perUnit.reduce((s, u) => s + u.bottleneckScore, 0) / perUnit.length * 10) / 10,
      meanMsPerSyllable: Math.round(perUnit.reduce((s, u) => s + u.msPerSyllable, 0) / perUnit.length * 10) / 10,
      scoreByType, countByType, byPassage,
      illusionCount: quizResults.filter(r => r.illusion).length,
      trueUnderstandingCount: quizResults.filter(r => r.trueUnderstanding).length,
      luckyGuessCount: quizResults.filter(r => r.luckyGuess).length,
    },
    submittedAt: new Date().toISOString(),
  };
}

async function sendToSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn('[경고] SHEETS_WEBHOOK_URL이 비어 있습니다. 콘솔에만 기록합니다.');
    console.log('[제출 데이터]', payload);
    return;
  }
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body, redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn('[일반 전송 실패, no-cors로 재시도]', e);
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body,
    });
  }
}

// ══════════ 4. 완료 화면 ══════════

function renderDone(data) {
  const { summary, session } = data;
  const scorePct = Math.round((summary.totalCorrect / summary.totalQuestions) * 100);

  const rows = data.reading.perUnit.map(u => {
    const qcount = data.quiz.filter(q => q.passageId === u.passageId && q.sourceUnit === u.unitId).length;
    const qcorr = data.quiz.filter(q => q.passageId === u.passageId && q.sourceUnit === u.unitId && q.correct).length;
    return `<tr>
      <td>${u.passageTitle}</td>
      <td>${u.topic}</td>
      <td class="num">${u.bottleneckScore}</td>
      <td class="num">${u.msPerSyllable}</td>
      <td class="num">${u.rereads}</td>
      <td class="num">${qcount ? `${qcorr}/${qcount}` : '-'}</td>
    </tr>`;
  }).join('');

  const illusion = summary.illusionCount > 0 ? `
    <div class="hint" style="margin-top:16px">
      <strong>이해 착각</strong> 감지: ${summary.illusionCount}문항 (틀렸지만 확신했던 문항)
    </div>` : '';

  $('done-body').innerHTML = `
    <div class="card">
      <h2>당신의 결과</h2>
      <p>선택한 난이도: <strong>${session.chosenLevelLabel}</strong>
         (평균 병목 점수 ${summary.meanBottleneck} / 10)</p>
      <p>전체 정답률: <strong>${summary.totalCorrect} / ${summary.totalQuestions} (${scorePct}%)</strong></p>
      <p>평균 음절당 읽기 시간: <strong>${summary.meanMsPerSyllable} ms</strong></p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>지문</th><th>내용</th>
              <th class="num">병목</th><th class="num">음절당(ms)</th>
              <th class="num">다시읽음</th><th class="num">정답</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${illusion}
    </div>`;
}
