// ============================================
// 병목 문장 독해 실험 — 자극 데이터
// ============================================
// 설계: 참가자가 시작 화면에서 난이도(상/중/하)를 직접 선택한다.
//   - 선택한 수준에 따라 두 지문(열팽창 · 삼투)을 모두 그 수준으로 읽는다.
//   - 지문은 명제 5개로 구성되며, 각 명제는 상/중/하 세 버전을 갖는다.
//   - 병목 점수(1~10)는 문법 자질로 계산한 연속 변인. 상/중/하는 라벨일 뿐이다.
//
// 왜 두 지문인가: 한 지문(명제 5개)만으로는 병목 점수 표본이 적어 신뢰도가 약함.
//   두 지문(명제 10개)이면 병목 점수-읽기시간 관계가 더 안정적으로 추정된다.
// ============================================

// 병목 점수 가중치 (2차 데이터 기반 재추정, 2026-07-17)
//   embeds  : 안긴절 수 — 데이터에서 읽기시간 최대 기여(표준화β +0.22, +1307ms/개). 최상위 가중치.
//   nominal : 명사화 수 — 2위 기여(+717ms/개). 안긴절 대비 약 0.55배(1307:717).
//   passive : 피동 수 — 길이 통제 시 순수 기여 없음(β −0.14). 이론적 최소치만 부여.
//   density : 절 밀도 — 안긴절과 r=0.75로 중복. 순수 기여 없으나, 일부 '하' 버전이
//             문장 쪼개기로 만들어져 안긴절 수가 되레 많은 탓에 순서 유지를 위해 소량만 유지.
//   ※ 산출 근거·과정은 WEIGHTS.md 참고. 이전 값: {2.0, 1.5, 1.2, 0.8}
const BOTTLENECK_WEIGHTS = { embeds: 2.7, nominal: 1.5, passive: 0.5, density: 0.3 };

const LEVELS = ['low', 'mid', 'high'];
const LEVEL_LABEL = { low: '하', mid: '중', high: '상' };

const passages = [
  {
    id: 'thermal',
    title: '열팽창과 바이메탈',
    units: [
      {
        id: 1, topic: '열팽창의 정의',
        versions: {
          high: { text: '물체의 온도가 변화하면 물체의 부피 또한 변화하게 되며, 이러한 부피 변화가 나타나는 현상은 열팽창이라 불린다.',
                  features: { embeds: 2, nominal: 1, passive: 1, clauses: 4, sentences: 1 } },
          mid:  { text: '물체는 온도가 변하면 부피 또한 변하게 되는데, 이렇게 부피가 변하는 현상을 열팽창이라 한다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 4, sentences: 1 } },
          low:  { text: '물체는 온도가 변하면 부피도 변한다. 이 현상을 열팽창이라 한다.',
                  features: { embeds: 1, nominal: 0, passive: 0, clauses: 3, sentences: 2 } },
        },
      },
      {
        id: 2, topic: '열팽창 계수',
        versions: {
          high: { text: '고체의 열팽창은 각 물질의 고유한 성질에 의해 결정되는 열팽창 계수라 불리는 값에 의해 그 정도가 정량적으로 서술된다.',
                  features: { embeds: 3, nominal: 1, passive: 3, clauses: 4, sentences: 1 } },
          mid:  { text: '고체가 열팽창하는 정도는 물질마다 고유하게 정해지는 열팽창 계수라 불리는 값으로 나타낸다.',
                  features: { embeds: 3, nominal: 0, passive: 2, clauses: 4, sentences: 1 } },
          low:  { text: '고체가 얼마나 팽창하는지는 물질마다 다르다. 이 정도를 열팽창 계수라 한다.',
                  features: { embeds: 1, nominal: 0, passive: 0, clauses: 3, sentences: 2 } },
        },
      },
      {
        id: 3, topic: '바이메탈이 휘는 원리',
        versions: {
          high: { text: '서로 다른 두 금속을 접합하여 만든 바이메탈은 온도 변화에 따라 두 금속의 팽창 정도가 달라짐으로써 발생하는 휨 현상을 이용하는 소자이다.',
                  features: { embeds: 4, nominal: 4, passive: 1, clauses: 5, sentences: 1 } },
          mid:  { text: '서로 다른 두 금속을 붙여 만든 바이메탈은 온도가 변할 때 두 금속이 서로 다르게 팽창하여 휘어지는 성질을 이용하는 소자이다.',
                  features: { embeds: 5, nominal: 0, passive: 1, clauses: 6, sentences: 1 } },
          low:  { text: '바이메탈은 서로 다른 두 금속을 붙여 만든다. 온도가 변하면 두 금속이 다르게 팽창한다. 그래서 바이메탈이 휘어진다.',
                  features: { embeds: 2, nominal: 0, passive: 1, clauses: 6, sentences: 3 } },
        },
      },
      {
        id: 4, topic: '최대 이동 거리',
        versions: {
          high: { text: '바이메탈의 최대 이동 거리는 휨을 방해하는 외부의 힘이 존재하지 않는다고 가정될 때, 주어진 온도 변화량에서 띠의 끝이 최대로 이동할 수 있는 거리이다.',
                  features: { embeds: 5, nominal: 2, passive: 2, clauses: 6, sentences: 1 } },
          mid:  { text: '바이메탈의 최대 이동 거리는 외부 힘이 없을 때 주어진 온도 변화에서 띠의 끝이 갈 수 있는 최대 거리를 뜻한다.',
                  features: { embeds: 2, nominal: 1, passive: 1, clauses: 5, sentences: 1 } },
          low:  { text: '바이메탈에 외부 힘이 작용하지 않는다고 하자. 이때 띠의 끝이 갈 수 있는 최대 거리가 있다. 이 거리를 최대 이동 거리라 한다. 온도가 많이 변하면 이 거리도 커진다.',
                  features: { embeds: 3, nominal: 0, passive: 0, clauses: 7, sentences: 4 } },
        },
      },
      {
        id: 5, topic: '온도 조절 장치',
        versions: {
          high: { text: '이러한 원리는 온도 변화에 의해 회로가 자동으로 개폐됨으로써 전류의 흐름이 조절되어야 하는 온도 조절 장치에 널리 이용된다.',
                  features: { embeds: 2, nominal: 3, passive: 3, clauses: 3, sentences: 1 } },
          mid:  { text: '이러한 원리는 온도가 변하면 회로가 자동으로 열리거나 닫혀 전류가 조절되는 온도 조절 장치에 널리 쓰인다.',
                  features: { embeds: 2, nominal: 0, passive: 1, clauses: 5, sentences: 1 } },
          low:  { text: '이 원리는 온도 조절 장치에 널리 쓰인다. 온도가 변하면 회로가 자동으로 열리거나 닫힌다. 그래서 전류가 흐르거나 멈춘다.',
                  features: { embeds: 1, nominal: 0, passive: 0, clauses: 5, sentences: 3 } },
        },
      },
    ],
    questions: [
      { id: 'T1', type: 'recall', sourceUnit: 2,
        text: '고체의 열팽창 계수 값은 무엇에 따라 정해지는가?',
        options: ['물체의 부피와 무게', '물질이 가진 고유한 성질', '가해진 온도 변화량', '두 금속을 접합한 방식'], answer: 1 },
      { id: 'T2', type: 'integration', sourceUnit: 3,
        text: '바이메탈이 휘어지는 과정을 옳게 설명한 것은?',
        options: [
          '두 금속이 같은 양만큼 팽창하지만 방향이 반대여서 휜다',
          '두 금속의 팽창 정도가 달라 덜 팽창한 쪽으로 휜다',
          '한 금속만 팽창하고 다른 금속은 수축하여 휜다',
          '두 금속 사이에 전류가 흘러 자기력으로 휜다',
        ], answer: 1 },
      { id: 'T3', type: 'inference', sourceUnit: 4,
        text: '외부에서 휨을 방해하는 힘이 점점 커지면 바이메탈의 실제 이동 거리는 어떻게 변하는가?',
        options: [
          '최대 이동 거리 그대로 변하지 않는다',
          '최대 이동 거리보다 커진다',
          '점점 짧아져 0에 가까워진다',
          '힘과 무관하게 일정하다',
        ], answer: 2 },
    ],
  },
  {
    id: 'osmosis',
    title: '삼투 현상',
    units: [
      {
        id: 1, topic: '삼투의 정의',
        versions: {
          high: { text: '용매만을 선택적으로 통과시키는 반투막을 사이에 두고 농도가 다른 두 용액이 존재할 때, 용매가 저농도 쪽에서 고농도 쪽으로 이동하는 현상이 삼투라 불린다.',
                  features: { embeds: 4, nominal: 2, passive: 2, clauses: 5, sentences: 1 } },
          mid:  { text: '용매만 통과시키는 반투막을 사이에 두고 농도가 다른 두 용액이 있으면, 용매가 저농도 쪽에서 고농도 쪽으로 이동하는데 이를 삼투라 한다.',
                  features: { embeds: 3, nominal: 0, passive: 1, clauses: 6, sentences: 2 } },
          low:  { text: '반투막은 용매만 통과시킨다. 이 막을 두고 농도가 다른 두 용액이 있다. 그러면 용매가 저농도 쪽에서 고농도 쪽으로 이동한다. 이 현상을 삼투라 한다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 6, sentences: 3 } },
        },
      },
      {
        id: 2, topic: '삼투가 일어나는 이유',
        versions: {
          high: { text: '삼투는 막을 경계로 양쪽 용액의 농도 차이가 감소되는 방향으로 용매가 확산됨으로써 두 용액의 농도가 같아지려는 경향에 의해 일어난다.',
                  features: { embeds: 4, nominal: 2, passive: 2, clauses: 6, sentences: 1 } },
          mid:  { text: '삼투는 막 양쪽 용액의 농도 차이를 줄이는 방향으로 용매가 이동하여 두 용액의 농도가 같아지려 하기 때문에 일어난다.',
                  features: { embeds: 3, nominal: 0, passive: 0, clauses: 6, sentences: 1 } },
          low:  { text: '막 양쪽 용액은 농도가 다르다. 용액은 농도가 같아지려 한다. 그래서 용매가 저농도 쪽에서 고농도 쪽으로 이동한다. 이렇게 삼투가 일어난다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 6, sentences: 4 } },
        },
      },
      {
        id: 3, topic: '삼투압',
        versions: {
          high: { text: '삼투압은 삼투에 의한 용매의 이동을 정지시키기 위해 고농도 용액 쪽에 가해져야 하는 압력으로 정의된다.',
                  features: { embeds: 3, nominal: 2, passive: 2, clauses: 5, sentences: 1 } },
          mid:  { text: '삼투압은 삼투에 의해 용매가 이동하는 것을 막기 위해 고농도 용액 쪽에 가해 주는 압력이다.',
                  features: { embeds: 3, nominal: 0, passive: 0, clauses: 4, sentences: 1 } },
          low:  { text: '삼투가 일어나면 용매가 이동한다. 이 이동을 막으려면 고농도 용액 쪽을 눌러 주어야 한다. 이때 필요한 압력을 삼투압이라 한다.',
                  features: { embeds: 1, nominal: 0, passive: 0, clauses: 3, sentences: 2 } },
        },
      },
      {
        id: 4, topic: '농도와 삼투압의 관계',
        versions: {
          high: { text: '일정한 온도에서 삼투압은 용액에 녹아 있는 용질 입자의 수가 많아질수록 그에 비례하여 증가되는 값으로 알려져 있다.',
                  features: { embeds: 5, nominal: 2, passive: 2, clauses: 7, sentences: 1 } },
          mid:  { text: '온도가 일정할 때 삼투압은 용액에 녹아 있는 용질 입자가 많을수록 그에 비례하여 커진다.',
                  features: { embeds: 3, nominal: 0, passive: 0, clauses: 6, sentences: 2 } },
          low:  { text: '온도를 일정하게 두자. 용액에 녹은 용질 입자가 많다고 하자. 그러면 삼투압도 그만큼 커진다. 즉 입자 수와 삼투압은 비례한다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 6, sentences: 4 } },
        },
      },
      {
        id: 5, topic: '삼투의 응용',
        versions: {
          high: { text: '이러한 원리는 바닷물에서 용질이 제거됨으로써 담수가 얻어지는 역삼투 방식의 해수 담수화 장치에 널리 이용된다.',
                  features: { embeds: 3, nominal: 2, passive: 3, clauses: 6, sentences: 1 } },
          mid:  { text: '이러한 원리는 바닷물에서 용질을 걸러 내어 민물을 얻는 역삼투 방식의 해수 담수화 장치에 널리 쓰인다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 5, sentences: 1 } },
          low:  { text: '이 원리는 바닷물을 민물로 바꾸는 데 쓰인다. 바닷물에 센 압력을 준다. 그러면 물만 반투막을 빠져나온다. 이렇게 소금기를 걸러 낸다.',
                  features: { embeds: 2, nominal: 0, passive: 0, clauses: 5, sentences: 4 } },
        },
      },
    ],
    questions: [
      { id: 'O1', type: 'recall', sourceUnit: 3,
        text: '삼투압에 대한 설명으로 옳은 것은?',
        options: [
          '용매를 저농도에서 고농도로 이동하게 만드는 힘',
          '용매의 이동을 멈추기 위해 고농도 용액 쪽에 가하는 압력',
          '용질이 반투막을 통과할 때 받는 저항',
          '두 용액의 온도 차이 때문에 생기는 압력',
        ], answer: 1 },
      { id: 'O2', type: 'integration', sourceUnit: 4,
        text: '온도가 일정할 때, 어떤 설탕물의 용질 입자 수를 두 배로 늘리면 삼투압은 대략 어떻게 되는가?',
        options: ['거의 변화 없다', '약 절반이 된다', '약 두 배가 된다', '예측할 수 없다'], answer: 2 },
      { id: 'O3', type: 'inference', sourceUnit: 5,
        text: '역삼투 방식의 해수 담수화에서 바닷물 쪽에 센 압력을 가하는 이유로 가장 적절한 것은?',
        options: [
          '삼투압을 이겨 물을 원래 삼투와 반대 방향으로 밀어내기 위해',
          '소금을 가열해 증발시키기 위해',
          '반투막의 구멍을 더 넓히기 위해',
          '용질이 스스로 막을 빠져나가게 하기 위해',
        ], answer: 0 },
    ],
  },
];

// 확신도 3범주
const confidenceOptions = [
  { value: 'sure', label: '확신함' },
  { value: 'unsure', label: '잘 모름' },
  { value: 'guess', label: '찍었음' },
];

// ── 병목 원점수 ──
function rawBottleneck(f) {
  return BOTTLENECK_WEIGHTS.embeds  * f.embeds
       + BOTTLENECK_WEIGHTS.nominal * f.nominal
       + BOTTLENECK_WEIGHTS.passive * f.passive
       + BOTTLENECK_WEIGHTS.density * (f.clauses / f.sentences);
}
function syllableCount(t) { const m = t.match(/[가-힣]/g); return m ? m.length : 0; }
function wordCount(t) { return t.trim().split(/\s+/).length; }

// ── 30개 버전(2지문 × 5명제 × 3수준) 전체를 1~10으로 정규화 ──
(function computeScores() {
  const raws = [];
  passages.forEach(p => p.units.forEach(u => LEVELS.forEach(L => raws.push(rawBottleneck(u.versions[L].features)))));
  const lo = Math.min(...raws), hi = Math.max(...raws);
  passages.forEach(p => p.units.forEach(u => LEVELS.forEach(L => {
    const v = u.versions[L];
    v.raw = Math.round(rawBottleneck(v.features) * 100) / 100;
    v.score = Math.round((1 + (v.raw - lo) / (hi - lo) * 9) * 10) / 10;
    v.syllables = syllableCount(v.text);
    v.words = wordCount(v.text);
  })));
})();

// 두 지문의 제시 순서 무작위화(순서 효과 상쇄)
function orderedPassages() {
  const arr = passages.slice();
  if (Math.floor(Math.random() * 2) === 1) arr.reverse();
  return arr;
}

// ── 명제별 병목 수준 무작위 배정 (개인 내 설계) ──
// 명제 n개(두 지문이면 10개)에 상/중/하를 최대한 고르게, 무작위 순서로 배정.
// 각 수준이 최소 3번씩은 나오도록 하여 한 참가자 안에서 세 수준 비교가 가능하게 한다.
// → 참가자가 스스로 고르지 않으므로 자기선택 편향이 사라진다.
function assignPropositionLevels(nProps) {
  const base = [];
  const per = Math.floor(nProps / LEVELS.length);
  LEVELS.forEach(L => { for (let i = 0; i < per; i++) base.push(L); });
  while (base.length < nProps) base.push(LEVELS[Math.floor(Math.random() * LEVELS.length)]);
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}
