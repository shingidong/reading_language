// ============================================
// 병목 문장 독해 실험 — 실행 로직
// ============================================
// 설계: 개인 내(within-subject). 명제 5개 각각에 병목 수준을 따로 무작위 배정.
// 측정: 명제별 읽기 시간(음절당으로 정규화) + 명제별 이해 정확도.
// 분석 단위: 참가자가 아니라 "명제 × 병목 점수".
// ============================================

const $ = (id) => document.getElementById(id);

const state = {
  session: null,     // { pid, grade, priorKnowledge, assignment, startedAt }
  plan: [],          // [{ unitId, topic, level, text, score, raw, syllables, words, features }]
  idx: 0,
  events: [],        // 화면 이탈 이벤트 원본 로그
  visits: {},        // 명제별 방문 횟수
  dwell: {},         // 명제별 누적 체류 시간(ms)
  enterTime: null,
  reading: null,
  answers: {},
  confidences: {},
  quizStart: null,
  responseTimes: {},
  submitting: false,
};

function showScreen(name) {
  ['start', 'read', 'quiz', 'done'].forEach(s => { $(`screen-${s}`).hidden = (s !== name); });
  window.scrollTo(0, 0);
}

// ══════════ 1. 시작 화면 ══════════

$('btn-start').addEventListener('click', () => {
  const pid = $('pid').value.trim();
  const grade = $('grade').value;
  const prior = $('prior').value;
  const err = $('start-err');
  const fail = (msg) => { err.textContent = msg; err.hidden = false; };

  if (!pid) return fail('참가자 ID를 입력해주세요.');
  if (!grade) return fail('국어 등급을 선택해주세요.');
  if (prior === '') return fail('배경지식 정도를 선택해주세요.');
  err.hidden = true;

  // ── 명제별 병목 수준 무작위 배정 ──
  const levels = assignLevels();           // 예: ['B3','B1','B4','B2','B1']
  const assignment = {};
  state.plan = units.map((u, i) => {
    const level = levels[i];
    const v = u.versions[level];
    assignment[u.id] = level;
    return {
      unitId: u.id,
      topic: u.topic,
      level,
      text: v.text,
      score: v.score,           // 병목 점수 (1~10, 연속 변인)
      raw: v.raw,               // 병목 원점수
      features: v.features,     // 안긴절/명사화/피동/절밀도 원자료
      syllables: v.syllables,   // 읽기 시간 정규화용
      words: v.words,
    };
  });

  state.session = {
    pid,
    grade,
    priorKnowledge: parseInt(prior, 10),
    assignment,                 // { 1:'B3', 2:'B1', ... }
    startedAt: new Date().toISOString(),
  };

  startReading();
});

// ══════════ 2. 읽기 화면 (명제 단위 자기조절 읽기) ══════════

function startReading() {
  state.idx = 0;
  state.events = [];
  state.visits = {};
  state.dwell = {};
  showScreen('read');
  enterUnit();
  window.addEventListener('keydown', readKeyHandler);
}

function enterUnit() {
  state.enterTime = performance.now();
  const id = state.plan[state.idx].unitId;
  state.visits[id] = (state.visits[id] || 0) + 1;
  renderUnit();
}

// 화면 이탈: 체류 시간을 명제별로 누적
function recordExit(direction) {
  if (state.enterTime == null) return;
  const item = state.plan[state.idx];
  const ms = Math.round(performance.now() - state.enterTime);
  state.dwell[item.unitId] = (state.dwell[item.unitId] || 0) + ms;
  state.events.push({
    unitId: item.unitId,
    level: item.level,
    bottleneckScore: item.score,
    dwellMs: ms,
    visit: state.visits[item.unitId] || 1,
    direction,                  // 'next' | 'prev' | 'finish'
    timestamp: Date.now(),
  });
}

function renderUnit() {
  const total = state.plan.length;
  const i = state.idx;
  const item = state.plan[i];

  $('sentence').textContent = item.text;
  $('read-counter').textContent = `${i + 1} / ${total}`;
  $('read-revisit').innerHTML =
    (state.visits[item.unitId] || 0) > 1 ? '<span class="revisit-tag">· 재방문</span>' : '';
  $('read-fill').style.width = `${((i + 1) / total) * 100}%`;
  $('btn-prev').disabled = (i === 0);
  $('btn-next').textContent = (i < total - 1) ? '다음 →' : '읽기 완료';
}

function goNext() {
  const total = state.plan.length;
  if (state.idx < total - 1) {
    recordExit('next');
    state.idx++;
    enterUnit();
  } else {
    recordExit('finish');
    finishReading();
  }
}

function goPrev() {
  if (state.idx > 0) {
    recordExit('prev');
    state.idx--;
    enterUnit();
  }
}

function finishReading() {
  // 명제별 최종 측정치 정리 — 이게 분석의 핵심 테이블이다.
  const perUnit = state.plan.map(item => {
    const totalMs = state.dwell[item.unitId] || 0;
    return {
      unitId: item.unitId,
      topic: item.topic,
      level: item.level,
      bottleneckScore: item.score,      // 독립변인 (연속)
      bottleneckRaw: item.raw,
      embeds: item.features.embeds,
      nominal: item.features.nominal,
      passive: item.features.passive,
      clauseDensity: Math.round((item.features.clauses / item.features.sentences) * 100) / 100,
      syllables: item.syllables,
      words: item.words,
      totalDwellMs: totalMs,            // 종속변인 (원자료)
      // ★ 길이 교란 통제: 음절당 읽기 시간. 조건 간 비교는 반드시 이 값으로!
      msPerSyllable: item.syllables ? Math.round((totalMs / item.syllables) * 10) / 10 : null,
      visits: state.visits[item.unitId] || 1,
      rereads: Math.max(0, (state.visits[item.unitId] || 1) - 1),
    };
  });

  state.reading = {
    perUnit,
    events: state.events,
    finishedAt: new Date().toISOString(),
  };

  window.removeEventListener('keydown', readKeyHandler);
  startQuiz();
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

// ══════════ 3. 이해 문항 화면 ══════════

function startQuiz() {
  const list = $('quiz-list');
  list.innerHTML = '';

  questions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'card';

    const idxLine = document.createElement('div');
    idxLine.className = 'q-index';
    idxLine.textContent = `문항 ${qi + 1} / ${questions.length}`;
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

  state.quizStart = performance.now();
  state.answers = {};
  state.confidences = {};
  state.responseTimes = {};
  showScreen('quiz');
}

function selectAnswer(qid, optIdx) {
  if (state.answers[qid] === undefined) {
    state.responseTimes[qid] = Math.round(performance.now() - state.quizStart);
  }
  state.answers[qid] = optIdx;
}

$('btn-submit').addEventListener('click', submit);

async function submit() {
  if (state.submitting) return;
  const err = $('quiz-err');

  const missing = [];
  questions.forEach(q => {
    if (state.answers[q.id] === undefined) missing.push(`${q.id} 답`);
    if (!state.confidences[q.id]) missing.push(`${q.id} 확신도`);
  });
  if (missing.length > 0) {
    err.textContent = `아직 응답하지 않은 항목이 있습니다: ${missing.slice(0, 3).join(', ')} 등`;
    err.hidden = false;
    return;
  }
  err.hidden = true;
  state.submitting = true;
  $('btn-submit').disabled = true;
  $('btn-submit').textContent = '전송 중...';

  const finalData = buildFinalData();

  try {
    const backup = JSON.parse(localStorage.getItem('exp_backup') || '[]');
    backup.push(finalData);
    localStorage.setItem('exp_backup', JSON.stringify(backup));
  } catch (e) { /* 저장 공간 부족 등은 무시 */ }

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
  const unitById = {};
  state.reading.perUnit.forEach(u => { unitById[u.unitId] = u; });

  // ── 문항 결과: 각 문항에 "그 문항의 근거 명제를 어떤 병목 수준으로 읽었는가"를 붙인다 ──
  //    이게 있어야 "병목 점수별 정확도"가 계산된다.
  const quizResults = questions.map(q => {
    const src = unitById[q.sourceUnit];
    const chosen = state.answers[q.id];
    const correct = chosen === q.answer;
    const confidence = state.confidences[q.id];
    return {
      qid: q.id,
      type: q.type,
      sourceUnit: q.sourceUnit,
      level: src.level,                       // 근거 명제의 병목 수준
      bottleneckScore: src.bottleneckScore,   // ★ 독립변인
      srcMsPerSyllable: src.msPerSyllable,    // 그 명제를 읽는 데 쓴 시간
      srcRereads: src.rereads,
      chosen,
      correct,
      confidence,
      responseMs: state.responseTimes[q.id] ?? null,
      illusion: !correct && confidence === 'sure',
      trueUnderstanding: correct && confidence === 'sure',
      luckyGuess: correct && confidence === 'guess',
    };
  });

  // ── 병목 수준별 집계 (이 참가자 안에서의 개인 내 비교) ──
  const byLevel = {};
  LEVELS.forEach(L => {
    const us = state.reading.perUnit.filter(u => u.level === L);
    const qs = quizResults.filter(r => r.level === L);
    byLevel[L] = {
      unitCount: us.length,
      meanMsPerSyllable: us.length
        ? Math.round(us.reduce((s, u) => s + u.msPerSyllable, 0) / us.length * 10) / 10 : null,
      meanRereads: us.length
        ? Math.round(us.reduce((s, u) => s + u.rereads, 0) / us.length * 100) / 100 : null,
      qCount: qs.length,
      correct: qs.filter(r => r.correct).length,
      accuracy: qs.length ? Math.round(qs.filter(r => r.correct).length / qs.length * 100) : null,
      illusion: qs.filter(r => r.illusion).length,
    };
  });

  const scoreByType = { recall: 0, integration: 0, inference: 0 };
  const countByType = { recall: 0, integration: 0, inference: 0 };
  quizResults.forEach(r => {
    countByType[r.type]++;
    if (r.correct) scoreByType[r.type]++;
  });

  return {
    session: state.session,
    reading: state.reading,
    quiz: quizResults,
    summary: {
      totalCorrect: quizResults.filter(r => r.correct).length,
      totalQuestions: quizResults.length,
      scoreByType,
      countByType,
      byLevel,
      illusionCount: quizResults.filter(r => r.illusion).length,
      trueUnderstandingCount: quizResults.filter(r => r.trueUnderstanding).length,
      luckyGuessCount: quizResults.filter(r => r.luckyGuess).length,
    },
    submittedAt: new Date().toISOString(),
  };
}

// Google Apps Script 웹훅으로 직접 전송.
// Content-Type을 text/plain으로 보내야 CORS preflight(OPTIONS)가 발생하지 않는다.
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
      body,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn('[일반 전송 실패, no-cors로 재시도]', e);
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
  }
}

// ══════════ 4. 완료 화면 ══════════

function renderDone(data) {
  const { summary } = data;
  const rows = data.reading.perUnit
    .slice()
    .sort((a, b) => a.bottleneckScore - b.bottleneckScore)
    .map(u => {
      const qs = data.quiz.filter(q => q.sourceUnit === u.unitId);
      const acc = qs.length ? `${qs.filter(q => q.correct).length} / ${qs.length}` : '-';
      return `<tr>
        <td>${u.topic}</td>
        <td class="num">${u.bottleneckScore}</td>
        <td class="num">${u.msPerSyllable}</td>
        <td class="num">${u.rereads}</td>
        <td class="num">${acc}</td>
      </tr>`;
    }).join('');

  const scorePct = Math.round((summary.totalCorrect / summary.totalQuestions) * 100);
  const illusion = summary.illusionCount > 0 ? `
    <div class="hint" style="margin-top:16px">
      <strong>이해 착각</strong> 감지: ${summary.illusionCount}문항 (틀렸지만 확신했던 문항)
      → 병목 문장이 <em>맞았다고 착각하게 만드는</em> 대표적 신호입니다.
    </div>` : '';

  $('done-body').innerHTML = `
    <div class="card">
      <h2>당신의 결과</h2>
      <p>전체 정답률: <strong>${summary.totalCorrect} / ${summary.totalQuestions} (${scorePct}%)</strong></p>
      <h3>병목 점수가 낮은 문장 → 높은 문장 순</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>내용</th>
              <th class="num">병목 점수</th>
              <th class="num">음절당 읽기(ms)</th>
              <th class="num">다시 읽음</th>
              <th class="num">정답</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="footer-note" style="text-align:left; margin-top:12px">
        '음절당 읽기'는 글자 수 차이를 보정한 값입니다. 병목 점수가 올라갈수록
        이 값이 커지고 정답이 줄어든다면, 문법 구조가 이해를 방해했다는 뜻입니다.
      </p>
      ${illusion}
    </div>`;
}
