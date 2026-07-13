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
// 7. 이 URL을 프로젝트의 config.js 파일 안 SHEETS_WEBHOOK_URL 에 붙여넣기
//    예) const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfy.../exec";
// 8. 수정한 config.js 를 깃허브에 커밋/푸시하면 끝
// ============================================
// 참고: 실험 페이지는 CORS preflight를 피하려고 Content-Type을 text/plain으로
// 보냅니다. Apps Script의 e.postData.contents 에는 그대로 JSON 문자열이 들어오므로
// 아래 JSON.parse 가 정상 동작합니다.
// ============================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── 1. 요약 시트 (한 참가자 = 한 행) ──
    let summarySheet = ss.getSheetByName('summary');
    if (!summarySheet) {
      summarySheet = ss.insertSheet('summary');
      summarySheet.appendRow([
        '제출시각', '참가자ID', '국어등급', '배경지식', '배정조건',
        '전체정답수', '전체문항수', '정답률(%)',
        '회상정답', '회상총', '통합정답', '통합총', '추론정답', '추론총',
        '이해착각수', '진짜이해수', '우연정답수',
        '읽기시작', '읽기완료', '제출완료',
      ]);
    }

    const s = data.session || {};
    const sm = data.summary || {};
    const scoreT = sm.scoreByType || {};
    const countT = sm.countByType || {};

    summarySheet.appendRow([
      data.submittedAt,
      s.pid, s.grade, s.priorKnowledge, s.condition,
      sm.totalCorrect, sm.totalQuestions,
      sm.totalQuestions ? Math.round((sm.totalCorrect / sm.totalQuestions) * 100) : 0,
      scoreT.recall || 0, countT.recall || 0,
      scoreT.integration || 0, countT.integration || 0,
      scoreT.inference || 0, countT.inference || 0,
      sm.illusionCount || 0, sm.trueUnderstandingCount || 0, sm.luckyGuessCount || 0,
      s.startedAt || '',
      (data.reading && data.reading.finishedAt) || '',
      data.submittedAt || '',
    ]);

    // ── 2. 읽기 로그 시트 (한 이동 = 한 행) ──
    let readingSheet = ss.getSheetByName('reading_logs');
    if (!readingSheet) {
      readingSheet = ss.insertSheet('reading_logs');
      readingSheet.appendRow([
        '제출시각', '참가자ID', '배정조건',
        '문장번호(0-based)', '체류시간(ms)', '방문차수', '이동방향', '이벤트시각(ms)',
      ]);
    }
    const logs = (data.reading && data.reading.logs) || [];
    logs.forEach(function (log) {
      readingSheet.appendRow([
        data.submittedAt, s.pid, s.condition,
        log.sentenceIdx, log.dwellMs, log.visit, log.direction, log.timestamp,
      ]);
    });

    // ── 3. 문항 응답 시트 ──
    let quizSheet = ss.getSheetByName('quiz_responses');
    if (!quizSheet) {
      quizSheet = ss.insertSheet('quiz_responses');
      quizSheet.appendRow([
        '제출시각', '참가자ID', '배정조건',
        '문항ID', '유형', '선택지', '정답여부', '확신도', '응답시간(ms)',
        '이해착각', '진짜이해', '우연정답',
      ]);
    }
    const quiz = data.quiz || [];
    quiz.forEach(function (q) {
      quizSheet.appendRow([
        data.submittedAt, s.pid, s.condition,
        q.qid, q.type, q.chosen, q.correct, q.confidence, q.responseMs,
        q.illusion, q.trueUnderstanding, q.luckyGuess,
      ]);
    });

    // ── 4. 원본 백업 시트 (JSON 통째) ──
    let rawSheet = ss.getSheetByName('raw_json');
    if (!rawSheet) {
      rawSheet = ss.insertSheet('raw_json');
      rawSheet.appendRow(['제출시각', '참가자ID', 'JSON']);
    }
    rawSheet.appendRow([data.submittedAt, s.pid, JSON.stringify(data)]);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    'Bottleneck Experiment Webhook OK'
  ).setMimeType(ContentService.MimeType.TEXT);
}
