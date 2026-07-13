# 병목 문장 독해 실험

한국어 과학 지문의 문법 구조(병목 강도)가 독해에 미치는 영향을 측정하는 웹 실험 도구.

**실험 페이지:** https://shingidong.github.io/reading_language/

---

## 실험 설계

- **독립변인**: 병목 강도 4단계 (B1 최소 ~ B4 최대) — 동일 명제, 문법 구조만 변형
- **종속변인**:
  - 문장별 읽기 시간 (자동 기록)
  - 재읽기 횟수 (자동 기록)
  - 이해 문항 정답률 (회상·통합·추론 각 2문항 = 총 6문항)
  - 문항별 확신도 (확신함/모름/찍음)
- **설계**: 개인 간(between-subjects) 무선 배정으로 스키마 선입 통제
- **자기평가 척도 미사용** → 응답 편향 회피, 행동 지표 중심

---

## 파일 구조

```
reading_language/
├── index.html            # 4개 화면 (시작 / 읽기 / 문항 / 완료)
├── app.js                # 실험 로직 (조건 배정, 시간 측정, 채점, 전송)
├── data.js               # 지문 4개 버전 + 이해 문항 6개
├── config.js             # ★ 구글 시트 웹훅 URL 설정 (여기만 고치면 됨)
├── styles.css            # 스타일
├── google_apps_script.js # 구글 스프레드시트 저장용 (Apps Script에 붙여넣기)
└── .nojekyll             # GitHub Pages가 파일을 그대로 서빙하도록 하는 표식
```

빌드 도구·서버가 필요 없는 순수 정적 사이트입니다. GitHub Pages에서 바로 동작합니다.

---

## 데이터 수집 설정 (필수)

`config.js`의 `SHEETS_WEBHOOK_URL`이 **비어 있으면 응답이 어디에도 저장되지 않습니다.**
(브라우저 콘솔에만 찍히는 테스트 모드로 동작합니다.)

실제로 데이터를 모으려면:

### 1단계 — 구글 스프레드시트 + Apps Script 배포

1. [구글 드라이브](https://drive.google.com)에서 **새 스프레드시트 생성** (예: `병목실험_데이터`)
2. 상단 메뉴 → **확장 프로그램 → Apps Script**
3. `google_apps_script.js`의 코드 전체를 복사해서 붙여넣기 (기존 코드는 삭제)
4. **저장** (Ctrl+S), 프로젝트 이름 지정
5. 우상단 **배포 → 새 배포**
   - 유형: **웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자** (익명 포함) ← 반드시!
6. **배포** 클릭 → 권한 승인
7. 발급된 **웹 앱 URL 복사** (`https://script.google.com/macros/s/.../exec`)

### 2단계 — config.js에 URL 넣고 푸시

```js
const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/여기에붙여넣기/exec";
```

```bash
git add config.js
git commit -m "구글 시트 웹훅 URL 설정"
git push
```

1~2분 뒤 GitHub Pages에 반영됩니다.

> **참고**: 정적 사이트라 웹훅 URL이 소스에 그대로 노출됩니다. 이 URL은 "데이터를 쓰기만" 할 수 있고
> 시트를 읽지는 못하므로 학급 단위 탐구에는 문제없지만, 장난 데이터가 들어올 가능성은 있습니다.
> 참가자 ID로 걸러내면 됩니다.

---

## 데이터 확인

구글 스프레드시트에 자동으로 4개 시트가 생성됩니다:

- **summary** — 참가자당 한 행. 조건, 정답률, 이해착각 수 등
- **reading_logs** — 문장별 읽기 시간·재방문 원본 로그
- **quiz_responses** — 문항별 응답·확신도 원본
- **raw_json** — 원본 JSON 백업

`summary` 시트만 봐도 조건별(B1~B4) 정답률·이해착각 비교가 바로 가능합니다.

### 분석 수식 예시

```
# B1~B4 조건별 평균 정답률
=AVERAGEIF(summary!E:E, "B1", summary!H:H)
=AVERAGEIF(summary!E:E, "B2", summary!H:H)
=AVERAGEIF(summary!E:E, "B3", summary!H:H)
=AVERAGEIF(summary!E:E, "B4", summary!H:H)

# B4 조건의 이해착각 평균
=AVERAGEIF(summary!E:E, "B4", summary!O:O)
```

---

## 로컬에서 미리 보기

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

---

## 참가자 안내 문구 예시

> "언어와 매체 개인 탐구를 위한 5~7분짜리 독해 실험이에요.
> 링크 들어가서 참가자 ID(반+번호+이니셜)만 넣고 참여해주면 큰 도움 됩니다!
> 결과는 익명 처리되고 다른 곳에 쓰이지 않아요."

---

## 참고 문헌

- Kintsch, W. (1988). *The role of knowledge in discourse comprehension: A construction-integration model.* Psychological Review.
- Sweller, J. (1988). *Cognitive load during problem solving.* Cognitive Science.
- Just & Carpenter (1992). *A capacity theory of comprehension.* Psychological Review.
- 이선희·이상빈 (2022). *한국어 관형절 처리의 작업기억 의존성.* 뇌·언어·인지.
