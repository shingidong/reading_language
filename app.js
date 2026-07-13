// ============================================
// 병목 문장 독해 실험 — 실행 로직
// 정적 사이트(GitHub Pages)용. 서버 없이 브라우저에서만 동작하며,
// 결과는 Google Apps Script 웹훅으로 직접 전송된다.
// ============================================

const $ = (id) => document.getElementById(id);

const state = {
  session: null,      // { pid, grade, priorKnowledge, condition, startedAt }
  passage: null,
  idx: 0,
  logs: [],           // 이동 로그 (raw events)
  visits: {},         // 문장별 방문 횟수
  enterTime: null,    // 현재 문장 진입 시각
  reading: null,      // { logs, visits, finishedAt }
  answers: {},        // { Q1: 2, ... }
  confidences: {},    // { Q1: 'sure', ... }
  quizStart: null,    // 문항 화면 진입 시각
  responseTimes: {},  // 문항별 최초 응답 시각
  submitting: false,
};

function showScreen(name) {
  ['start', 'read', 'quiz', 'done'].forEach(s => {
    $(`screen-${s}`).hidden = (s !== name);
  });
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

  // 조건 무작위 배정 (B1~B4)
  const conditions = ['B1', 'B2', 'B3', 'B4'];
  const condition = conditions[Math.floor(Math.random() * 4)];

  state.session = {
    pid,
    grade,
    priorKnowledge: parseInt(prior, 10),
    condition,
    startedAt: new Date().toISOString(),
  };
  state.passage = passages[condition];

  startReading();
});

// ══════════ 2. 읽기 화면 ══════════

function startReading() {
  state.idx = 0;
  state.logs = [];
  state.visits = {};
  showScreen('read');
  enterSentence();
  window.addEventListener('keydown', readKeyHandler);
}

// 문장 진입: 체류 시간 측정 시작 + 방문 횟수 증가
function enterSentence() {
  state.enterTime = performance.now();
  state.visits[state.idx] = (state.visits[state.idx] || 0) + 1;
  renderSentence();
}

// 문장 이탈: 체류 시간 기록
function recordExit(direction) {
  if (state.enterTime == null) return;
  state.logs.push({
    sentenceIdx: state.idx,
    dwellMs: Math.round(performance.now() - state.enterTime),
    visit: state.visits[state.idx] || 1,
    direction,                    // 'next' | 'prev' | 'finish'
    timestamp: Date.now(),
  });
}

function renderSentence() {
  const total = state.passage.sentences.length;
  const i = state.idx;

  $('sentence').textContent = state.passage.sentences[i];
  $('read-counter').textContent = `문장 ${i + 1} / ${total}`;
  $('read-revisit').innerHTML =
    (state.visits[i] || 0) > 1 ? '<span class="revisit-tag">· 재방문</span>' : '';
  $('read-fill').style.width = `${((i + 1) / total) * 100}%`;
  $('btn-prev').disabled = (i === 0);
  $('btn-next').textContent = (i < total - 1) ? '다음 문장 →' : '읽기 완료';
}

function goNext() {
  const total = state.passage.sentences.length;
  if (state.idx < total - 1) {
    recordExit('next');
    state.idx++;
    enterSentence();
  } else {
    // 마지막 문장 → 이해 문항으로
    recordExit('finish');
    state.reading = {
      logs: state.logs,
      visits: state.visits,
      finishedAt: new Date().toISOString(),
    };
    window.removeEventListener('keydown', readKeyHandler);
    startQuiz();
  }
}

function goPrev() {
  if (state.idx > 0) {
    recordExit('prev');
    state.idx--;
    enterSentence();
  }
}

function readKeyHandler(e) {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
    e.preventDefault();
    goNext();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    goPrev();
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

    // 선택지
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

    // 확신도
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

  // 문항별 응답 시간의 기준점 (한 화면에 전부 표시되므로 진입 시각 하나로 통일)
  state.quizStart = performance.now();
  state.answers = {};
  state.confidences = {};
  state.responseTimes = {};
  showScreen('quiz');
}

function selectAnswer(qid, optIdx) {
  if (state.answers[qid] === undefined) {
    // 첫 응답 → 응답 시간 기록
    state.responseTimes[qid] = Math.round(performance.now() - state.quizStart);
  }
  state.answers[qid] = optIdx;
}

$('btn-submit').addEventListener('click', submit);

async function submit() {
  if (state.submitting) return;
  const err = $('quiz-err');

  // 미응답 검증
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

  // 전송 실패에 대비해 브라우저에 백업 (개발자 도구에서 회수 가능)
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
  // 이해 문항 결과 정리
  const quizResults = questions.map(q => {
    const chosen = state.answers[q.id];
    const correct = chosen === q.answer;
    const confidence = state.confidences[q.id];
    return {
      qid: q.id,
      type: q.type,
      chosen,
      correct,
      confidence,
      responseMs: state.responseTimes[q.id] ?? null,
      illusion: !correct && confidence === 'sure',          // 이해 착각: 오답 + 확신함
      trueUnderstanding: correct && confidence === 'sure',  // 진짜 이해: 정답 + 확신함
      luckyGuess: correct && confidence === 'guess',        // 우연 정답: 정답 + 찍음
    };
  });

  // 층위별 정답률
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
      illusionCount: quizResults.filter(r => r.illusion).length,
      trueUnderstandingCount: quizResults.filter(r => r.trueUnderstanding).length,
      luckyGuessCount: quizResults.filter(r => r.luckyGuess).length,
    },
    submittedAt: new Date().toISOString(),
  };
}

// Google Apps Script 웹훅으로 직접 전송.
// Content-Type을 text/plain으로 보내야 CORS preflight(OPTIONS)가 발생하지 않는다.
// Apps Script의 e.postData.contents에는 그대로 JSON 문자열이 들어온다.
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
    return;
  } catch (e) {
    // 일부 브라우저/네트워크 환경에서 CORS가 막히는 경우를 대비한 폴백.
    // 응답을 읽을 수는 없지만(opaque) 요청 자체는 전달된다.
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
  const { summary, session } = data;
  const scorePct = Math.round((summary.totalCorrect / summary.totalQuestions) * 100);
  const strength = { B4: '최대', B3: '상', B2: '중', B1: '최소' }[session.condition];

  const illusionBlock = summary.illusionCount > 0 ? `
    <div class="hint" style="margin-top:16px">
      <strong>이해 착각</strong> 감지: ${summary.illusionCount}문항 (틀렸지만 확신했던 문항)
      → 병목 문장이 <em>맞았다고 착각하게 만드는</em> 대표적 신호입니다.
    </div>` : '';

  $('done-body').innerHTML = `
    <div class="card">
      <h2>당신의 결과</h2>
      <p>배정 조건: <strong>${session.condition}</strong> (병목 강도 ${strength})</p>
      <p>전체 정답률: <strong>${summary.totalCorrect} / ${summary.totalQuestions} (${scorePct}%)</strong></p>
      <h3>층위별 정답률</h3>
      <ul class="result-list">
        <li>회상(표층): ${summary.scoreByType.recall} / ${summary.countByType.recall}</li>
        <li>통합(텍스트 기저): ${summary.scoreByType.integration} / ${summary.countByType.integration}</li>
        <li>추론(상황 모형): ${summary.scoreByType.inference} / ${summary.countByType.inference}</li>
      </ul>
      ${illusionBlock}
    </div>`;
}
