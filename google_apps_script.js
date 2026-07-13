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
// 6. 배포 → 웹 앱 URL 복사 (https://script.google.com/macros/s/..../exec)
// 7. 이 URL을 config.js 의 SHEETS_WEBHOOK_URL 에 붙여넣고 깃허브에 푸시
// ============================================
// 만들어지는 시트 4개:
//   analysis        ★ 분석용 메인 테이블 (참가자 × 명제 = 한 행)
//   quiz_responses    문항별 응답 (근거 명제의 병목 점수가 붙어 있음)
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

    // ══════════════════════════════════════════════
    // 1. analysis ★ — 이 시트 하나로 논문/보고서 분석이 다 됩니다.
    //    한 행 = 참가자 한 명이 명제 하나를 읽은 기록.
    //    x축: 병목점수 / y축: 음절당읽기시간, 정답률
    // ══════════════════════════════════════════════
    const analysis = getSheet(ss, 'analysis', [
      '제출시각', '참가자ID', '국어등급', '배경지식',
      '명제ID', '주제', '병목수준', '병목점수',
      '안긴절', '명사화', '피동', '절밀도',
      '음절수', '어절수',
      '총읽기시간(ms)', '음절당읽기시간(ms)', '재읽기횟수',
      '해당문항수', '해당정답수', '해당정답률(%)',
    ]);

    perUnit.forEach(function (u) {
      const qs = quiz.filter(function (q) { return q.sourceUnit === u.unitId; });
      const nCorrect = qs.filter(function (q) { return q.correct; }).length;
      analysis.appendRow([
        when, s.pid, s.grade, s.priorKnowledge,
        u.unitId, u.topic, u.level, u.bottleneckScore,
        u.embeds, u.nominal, u.passive, u.clauseDensity,
        u.syllables, u.words,
        u.totalDwellMs, u.msPerSyllable, u.rereads,
        qs.length, nCorrect,
        qs.length ? Math.round(nCorrect / qs.length * 100) : '',
      ]);
    });

    // ══════════════════════════════════════════════
    // 2. quiz_responses — 문항별 원자료
    // ══════════════════════════════════════════════
    const quizSheet = getSheet(ss, 'quiz_responses', [
      '제출시각', '참가자ID',
      '문항ID', '유형', '근거명제', '병목수준', '병목점수',
      '선택지', '정답여부', '확신도', '응답시간(ms)',
      '근거명제_음절당읽기(ms)', '근거명제_재읽기',
      '이해착각', '진짜이해', '우연정답',
    ]);
    quiz.forEach(function (q) {
      quizSheet.appendRow([
        when, s.pid,
        q.qid, q.type, q.sourceUnit, q.level, q.bottleneckScore,
        q.chosen, q.correct, q.confidence, q.responseMs,
        q.srcMsPerSyllable, q.srcRereads,
        q.illusion, q.trueUnderstanding, q.luckyGuess,
      ]);
    });

    // ══════════════════════════════════════════════
    // 3. participants — 참가자별 요약 (개인 내 비교용)
    // ══════════════════════════════════════════════
    const byL = sm.byLevel || {};
    const participants = getSheet(ss, 'participants', [
      '제출시각', '참가자ID', '국어등급', '배경지식',
      '명제1배정', '명제2배정', '명제3배정', '명제4배정', '명제5배정',
      '전체정답수', '전체문항수', '전체정답률(%)',
      '회상정답', '통합정답', '추론정답',
      'B1_음절당ms', 'B2_음절당ms', 'B3_음절당ms', 'B4_음절당ms',
      'B1_정답률', 'B2_정답률', 'B3_정답률', 'B4_정답률',
      '이해착각수', '진짜이해수', '우연정답수',
      '읽기시작', '읽기완료',
    ]);
    const a = s.assignment || {};
    const scoreT = sm.scoreByType || {};
    participants.appendRow([
      when, s.pid, s.grade, s.priorKnowledge,
      a['1'], a['2'], a['3'], a['4'], a['5'],
      sm.totalCorrect, sm.totalQuestions,
      sm.totalQuestions ? Math.round(sm.totalCorrect / sm.totalQuestions * 100) : 0,
      scoreT.recall || 0, scoreT.integration || 0, scoreT.inference || 0,
      lv(byL, 'B1', 'meanMsPerSyllable'), lv(byL, 'B2', 'meanMsPerSyllable'),
      lv(byL, 'B3', 'meanMsPerSyllable'), lv(byL, 'B4', 'meanMsPerSyllable'),
      lv(byL, 'B1', 'accuracy'), lv(byL, 'B2', 'accuracy'),
      lv(byL, 'B3', 'accuracy'), lv(byL, 'B4', 'accuracy'),
      sm.illusionCount || 0, sm.trueUnderstandingCount || 0, sm.luckyGuessCount || 0,
      s.startedAt || '',
      (data.reading && data.reading.finishedAt) || '',
    ]);

    // ══════════════════════════════════════════════
    // 4. raw_json — 원본 백업 (이동 이벤트 로그 포함)
    // ══════════════════════════════════════════════
    const raw = getSheet(ss, 'raw_json', ['제출시각', '참가자ID', 'JSON']);
    raw.appendRow([when, s.pid, JSON.stringify(data)]);

    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── 헬퍼 ──

function getSheet(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function lv(byLevel, level, key) {
  const o = byLevel[level];
  return (o && o[key] !== null && o[key] !== undefined) ? o[key] : '';
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Bottleneck Experiment Webhook OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
