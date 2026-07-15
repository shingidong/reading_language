// ============================================
// Google Apps Script (구글 스프레드시트에 붙여넣기)
// ============================================
// 사용 방법:
// 1. 구글 드라이브 → 새 스프레드시트 생성 (예: "병목실험_데이터")
// 2. 확장 프로그램 → Apps Script 클릭
// 3. 아래 코드 전체를 복사 붙여넣기 (기존 코드 삭제)
// 4. 저장 (Ctrl+S) → 프로젝트 이름 지정
// 5. 배포 → 새 배포 → 유형: 웹 앱
//    - 실행 계정: 나
//    - 액세스 권한: 모든 사용자 (익명 포함)   ← 반드시 이걸로!
// 6. 배포 → 웹 앱 URL 복사 → config.js 의 SHEETS_WEBHOOK_URL 에 붙여넣고 푸시
// ============================================
// 만들어지는 시트 4개:
//   analysis        ★ 분석용 메인 (참가자 × 명제 = 한 행, 두 지문이면 10행)
//   quiz_responses    문항별 응답
//   participants      참가자별 요약 (한 명 = 한 행)
//   raw_json          원본 백업
// ============================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const s  = data.session || {};
    const sm = data.summary || {};
    const perUnit = (data.reading && data.reading.perUnit) || [];
    const quiz = data.quiz || [];
    const when = data.submittedAt;

    // ── 1. analysis ★ ──
    const analysis = getSheet(ss, 'analysis', [
      '제출시각', '참가자ID', '국어등급', '배경지식', '선택난이도',
      '지문', '명제ID', '주제', '병목점수',
      '안긴절', '명사화', '피동', '절밀도', '음절수', '어절수',
      '총읽기시간(ms)', '음절당읽기시간(ms)', '재읽기횟수',
      '해당문항수', '해당정답수', '해당정답률(%)',
    ]);
    perUnit.forEach(function (u) {
      const qs = quiz.filter(function (q) { return q.passageId === u.passageId && q.sourceUnit === u.unitId; });
      const nCorrect = qs.filter(function (q) { return q.correct; }).length;
      analysis.appendRow([
        when, s.pid, s.grade, s.priorKnowledge, s.chosenLevelLabel,
        u.passageTitle, u.unitId, u.topic, u.bottleneckScore,
        u.embeds, u.nominal, u.passive, u.clauseDensity, u.syllables, u.words,
        u.totalDwellMs, u.msPerSyllable, u.rereads,
        qs.length, nCorrect, qs.length ? Math.round(nCorrect / qs.length * 100) : '',
      ]);
    });

    // ── 2. quiz_responses ──
    const quizSheet = getSheet(ss, 'quiz_responses', [
      '제출시각', '참가자ID', '선택난이도',
      '지문', '문항ID', '유형', '근거명제', '병목점수',
      '선택지', '정답여부', '확신도', '응답시간(ms)',
      '근거명제_음절당읽기(ms)', '근거명제_재읽기',
      '이해착각', '진짜이해', '우연정답',
    ]);
    quiz.forEach(function (q) {
      quizSheet.appendRow([
        when, s.pid, s.chosenLevelLabel,
        q.passageId, q.qid, q.type, q.sourceUnit, q.bottleneckScore,
        q.chosen, q.correct, q.confidence, q.responseMs,
        q.srcMsPerSyllable, q.srcRereads,
        q.illusion, q.trueUnderstanding, q.luckyGuess,
      ]);
    });

    // ── 3. participants ──
    const bp = sm.byPassage || {};
    const pids = Object.keys(bp);
    const participants = getSheet(ss, 'participants', [
      '제출시각', '참가자ID', '국어등급', '배경지식', '선택난이도',
      '평균병목점수', '평균음절당읽기(ms)',
      '전체정답수', '전체문항수', '전체정답률(%)',
      '회상정답', '통합정답', '추론정답',
      '지문A_정답', '지문A_음절당ms', '지문B_정답', '지문B_음절당ms',
      '이해착각수', '진짜이해수', '우연정답수',
      '읽기시작', '읽기완료',
    ]);
    const scoreT = sm.scoreByType || {};
    const A = pids[0] ? bp[pids[0]] : {};
    const B = pids[1] ? bp[pids[1]] : {};
    participants.appendRow([
      when, s.pid, s.grade, s.priorKnowledge, s.chosenLevelLabel,
      sm.meanBottleneck, sm.meanMsPerSyllable,
      sm.totalCorrect, sm.totalQuestions,
      sm.totalQuestions ? Math.round(sm.totalCorrect / sm.totalQuestions * 100) : 0,
      scoreT.recall || 0, scoreT.integration || 0, scoreT.inference || 0,
      A.total ? (A.correct + '/' + A.total) : '', A.msPerSyllable || '',
      B.total ? (B.correct + '/' + B.total) : '', B.msPerSyllable || '',
      sm.illusionCount || 0, sm.trueUnderstandingCount || 0, sm.luckyGuessCount || 0,
      s.startedAt || '', (data.reading && data.reading.finishedAt) || '',
    ]);

    // ── 4. raw_json ──
    const raw = getSheet(ss, 'raw_json', ['제출시각', '참가자ID', 'JSON']);
    raw.appendRow([when, s.pid, JSON.stringify(data)]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function getSheet(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput('Bottleneck Experiment Webhook OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
