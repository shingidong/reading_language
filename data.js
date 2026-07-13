// ============================================
// 병목 문장 독해 실험 — 자극 데이터
// ============================================
// 구조: 같은 명제 5개를 병목 강도 4수준(B1~B4)으로 각각 다르게 표현.
// 참가자마다 명제별로 수준을 따로 무작위 배정 → 한 사람이 여러 병목 수준을 읽는다.
// (개인 내 설계: 읽기 속도·국어 실력 같은 개인차가 자동으로 상쇄됨)
//
// 병목 점수 = 문법 자질로 계산 (아래 BOTTLENECK_WEIGHTS 참고).
// B1~B4는 "설계 의도"일 뿐이고, 실제 분석에 쓰는 연속 변인은 이 점수다.
// ============================================

// 병목 점수 가중치
//   embeds  : 안긴절 수 (관형절·명사절·부사절·인용절) — 작업기억에 미완결 구조를 쌓음
//   nominal : 명사화 수 (용언을 명사로 압축, 예: 부피가 변함 → 부피 변화)
//   passive : 피동 표현 수 ('-되다', '-어지다' 등 행위자를 숨기는 형태)
//   density : 문장당 절 밀도 (절 수 ÷ 문장 수) — 한 문장에 절을 몇 개나 욱여넣었는가
const BOTTLENECK_WEIGHTS = { embeds: 2.0, nominal: 1.5, passive: 1.2, density: 0.8 };

const units = [
  {
    id: 1,
    topic: '열팽창의 정의',
    versions: {
      B4: {
        text: '물체의 온도가 변화하면 물체의 부피 또한 변화하게 되며, 이러한 부피 변화가 나타나는 현상을 열팽창이라 한다.',
        features: { embeds: 2, nominal: 1, passive: 0, clauses: 4, sentences: 1 },
      },
      B3: {
        text: '물체의 온도가 변하면 부피 또한 변하게 되며, 이렇게 부피가 변하는 현상을 열팽창이라 한다.',
        features: { embeds: 2, nominal: 0, passive: 0, clauses: 4, sentences: 1 },
      },
      B2: {
        text: '물체는 온도가 변하면 부피도 변한다. 이렇게 부피가 변하는 현상을 열팽창이라 한다.',
        features: { embeds: 2, nominal: 0, passive: 0, clauses: 4, sentences: 2 },
      },
      B1: {
        text: '물체는 온도가 변하면 부피도 변한다. 이 현상을 열팽창이라 한다.',
        features: { embeds: 1, nominal: 0, passive: 0, clauses: 3, sentences: 2 },
      },
    },
  },
  {
    id: 2,
    topic: '열팽창 계수',
    versions: {
      B4: {
        text: '고체의 열팽창은 각 물질의 고유한 성질에 의해 결정되는 열팽창 계수라 불리는 값에 의해 그 정도가 정량적으로 서술된다.',
        features: { embeds: 3, nominal: 1, passive: 3, clauses: 4, sentences: 1 },
      },
      B3: {
        text: '고체가 열팽창하는 정도는 물질마다 고유하게 정해지는 열팽창 계수라 불리는 값으로 정량적으로 나타낸다.',
        features: { embeds: 3, nominal: 0, passive: 2, clauses: 4, sentences: 1 },
      },
      B2: {
        text: '고체가 얼마나 열팽창하는지는 물질마다 다르다. 이 정도를 나타내는 값을 열팽창 계수라 한다.',
        features: { embeds: 2, nominal: 0, passive: 0, clauses: 4, sentences: 2 },
      },
      B1: {
        text: '고체가 얼마나 팽창하는지는 물질마다 다르다. 이 정도를 열팽창 계수라 한다.',
        features: { embeds: 1, nominal: 0, passive: 0, clauses: 3, sentences: 2 },
      },
    },
  },
  {
    id: 3,
    topic: '바이메탈이 휘는 원리',
    versions: {
      B4: {
        text: '서로 다른 두 금속을 접합하여 만든 바이메탈은 온도 변화에 따라 두 금속의 팽창 정도가 달라짐으로써 발생하는 휨 현상을 이용하는 소자이다.',
        features: { embeds: 4, nominal: 4, passive: 0, clauses: 5, sentences: 1 },
      },
      B3: {
        text: '서로 다른 두 금속을 붙여 만든 바이메탈은 온도가 변할 때 두 금속이 서로 다르게 팽창하여 휘어지는 성질을 이용하는 소자이다.',
        features: { embeds: 5, nominal: 0, passive: 1, clauses: 6, sentences: 1 },
      },
      B2: {
        text: '바이메탈은 서로 다른 두 금속을 붙여 만든 소자이다. 온도가 변하면 두 금속이 다르게 팽창하여 휘어진다.',
        features: { embeds: 3, nominal: 0, passive: 1, clauses: 6, sentences: 2 },
      },
      B1: {
        text: '바이메탈은 서로 다른 두 금속을 붙여 만든다. 온도가 변하면 두 금속이 다르게 팽창한다. 그래서 바이메탈이 휘어진다.',
        features: { embeds: 2, nominal: 0, passive: 1, clauses: 6, sentences: 3 },
      },
    },
  },
  {
    id: 4,
    topic: '최대 이동 거리',
    versions: {
      B4: {
        text: '바이메탈의 최대 이동 거리는 휨을 방해하는 외부의 힘이 없다고 가정할 때, 주어진 온도 변화량에서 띠의 끝이 최대로 이동할 수 있는 거리이다.',
        features: { embeds: 5, nominal: 2, passive: 1, clauses: 6, sentences: 1 },
      },
      B3: {
        text: '바이메탈의 최대 이동 거리는 외부에서 휘어지는 것을 방해하는 힘이 작용하지 않을 때, 주어진 온도 변화에서 띠의 끝이 최대로 이동할 수 있는 거리이다.',
        features: { embeds: 5, nominal: 1, passive: 2, clauses: 6, sentences: 1 },
      },
      B2: {
        text: '바이메탈의 최대 이동 거리는 외부 힘이 없을 때 띠의 끝이 갈 수 있는 최대 거리이다. 이 거리는 온도 변화량에 따라 정해진다.',
        features: { embeds: 2, nominal: 1, passive: 1, clauses: 4, sentences: 2 },
      },
      B1: {
        text: '바이메탈에 외부 힘이 작용하지 않는다고 하자. 이때 띠의 끝이 갈 수 있는 최대 거리가 있다. 이 거리를 바이메탈의 최대 이동 거리라 한다. 온도가 많이 변하면 이 거리도 커진다.',
        features: { embeds: 3, nominal: 0, passive: 0, clauses: 7, sentences: 4 },
      },
    },
  },
  {
    id: 5,
    topic: '온도 조절 장치',
    versions: {
      B4: {
        text: '이러한 원리는 온도 변화에 의해 회로가 자동으로 개폐됨으로써 전류의 흐름이 조절되어야 하는 온도 조절 장치에 널리 이용되고 있다.',
        features: { embeds: 2, nominal: 3, passive: 3, clauses: 3, sentences: 1 },
      },
      B3: {
        text: '이러한 원리는 온도가 변하면 회로가 자동으로 열리거나 닫혀 전류가 조절되는 온도 조절 장치에 널리 쓰이고 있다.',
        features: { embeds: 2, nominal: 0, passive: 1, clauses: 5, sentences: 1 },
      },
      B2: {
        text: '이 원리는 온도 조절 장치에 널리 쓰인다. 온도가 변하면 회로가 자동으로 열리거나 닫혀 전류를 조절한다.',
        features: { embeds: 1, nominal: 0, passive: 0, clauses: 5, sentences: 2 },
      },
      B1: {
        text: '이 원리는 온도 조절 장치에 널리 쓰인다. 온도가 변하면 회로가 자동으로 열리거나 닫힌다. 그래서 전류가 흐르거나 멈춘다.',
        features: { embeds: 1, nominal: 0, passive: 0, clauses: 5, sentences: 3 },
      },
    },
  },
];

const LEVELS = ['B1', 'B2', 'B3', 'B4'];

// ── 병목 원점수 계산 ──
function rawBottleneck(f) {
  return BOTTLENECK_WEIGHTS.embeds  * f.embeds
       + BOTTLENECK_WEIGHTS.nominal * f.nominal
       + BOTTLENECK_WEIGHTS.passive * f.passive
       + BOTTLENECK_WEIGHTS.density * (f.clauses / f.sentences);
}

// ── 한글 음절 수 (읽기 시간 정규화용 — 길이 교란 통제의 핵심) ──
function syllableCount(text) {
  const m = text.match(/[가-힣]/g);
  return m ? m.length : 0;
}

// 어절 수
function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

// ── 20개 버전 전체에 대해 원점수 → 1~10 정규화 점수 부여 ──
(function computeScores() {
  const raws = [];
  units.forEach(u => LEVELS.forEach(L => raws.push(rawBottleneck(u.versions[L].features))));
  const lo = Math.min(...raws);
  const hi = Math.max(...raws);

  units.forEach(u => LEVELS.forEach(L => {
    const v = u.versions[L];
    v.raw = Math.round(rawBottleneck(v.features) * 100) / 100;
    v.score = Math.round((1 + (v.raw - lo) / (hi - lo) * 9) * 10) / 10; // 1.0 ~ 10.0
    v.syllables = syllableCount(v.text);
    v.words = wordCount(v.text);
  }));
})();

// ── 이해 문항 6개 ──
// sourceUnit: 이 문항을 풀려면 반드시 읽어야 하는 명제 번호.
//   → 참가자가 그 명제를 어떤 병목 수준으로 읽었는지에 따라
//     "병목 점수별 정확도"를 계산할 수 있다.
const questions = [
  {
    id: 'Q1',
    type: 'recall',        // 회상 (표층)
    sourceUnit: 1,
    text: '열팽창은 무엇이 변할 때 나타나는 현상인가?',
    options: ['압력', '온도', '무게', '전류'],
    answer: 1,
  },
  {
    id: 'Q2',
    type: 'recall',        // 회상 (표층)
    sourceUnit: 2,
    text: '고체의 열팽창 정도를 나타내는 값의 이름은?',
    options: ['탄성 계수', '열팽창 계수', '전도 계수', '팽창 지수'],
    answer: 1,
  },
  {
    id: 'Q3',
    type: 'integration',   // 통합 (텍스트 기저)
    sourceUnit: 3,
    text: '바이메탈이 휘어지는 이유로 가장 적절한 것은?',
    options: [
      '두 금속의 무게가 다르기 때문',
      '두 금속의 팽창 정도가 다르기 때문',
      '외부에서 힘을 가하기 때문',
      '전류가 흐르기 때문',
    ],
    answer: 1,
  },
  {
    id: 'Q4',
    type: 'integration',   // 통합 (텍스트 기저)
    sourceUnit: 4,
    text: '바이메탈의 최대 이동 거리가 결정되는 두 조건을 모두 고른 것은?',
    options: [
      '외부 힘 부재 + 온도 변화량',
      '외부 힘 부재 + 금속의 종류',
      '온도 변화량 + 전류의 세기',
      '금속의 종류 + 전류의 세기',
    ],
    answer: 0,
  },
  {
    id: 'Q5',
    type: 'inference',     // 추론 (상황 모형)
    sourceUnit: 4,
    text: '외부에서 바이메탈의 휨을 방해하는 힘이 작용한다면 실제 이동 거리는 어떻게 되는가?',
    options: [
      '변화 없다',
      '최대 이동 거리보다 짧아진다',
      '최대 이동 거리보다 길어진다',
      '무한대가 된다',
    ],
    answer: 1,
  },
  {
    id: 'Q6',
    type: 'inference',     // 추론 (상황 모형)
    sourceUnit: 5,
    text: '온도 조절 장치가 특정 온도에서 회로를 여는 이유로 가장 적절한 것은?',
    options: [
      '금속의 무게가 커지므로',
      '금속이 팽창하여 바이메탈이 휘어지므로',
      '전류가 자동으로 강해지므로',
      '외부 힘이 사라지므로',
    ],
    answer: 1,
  },
];

// 확신도 3범주
const confidenceOptions = [
  { value: 'sure', label: '확신함' },
  { value: 'unsure', label: '잘 모름' },
  { value: 'guess', label: '찍었음' },
];

// ── 명제별 병목 수준 무작위 배정 ──
// 명제 5개 각각에 B1~B4 중 하나를 배정하되,
// 4개 수준이 모두 최소 1번씩은 나오도록 보장한다.
// (그래야 참가자 한 명 안에서 병목 수준 간 비교가 성립한다)
function assignLevels() {
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const base = shuffle(LEVELS);                              // B1~B4 각 1개
  const extra = LEVELS[Math.floor(Math.random() * 4)];       // 5번째는 무작위
  return shuffle(base.concat([extra]));                      // 명제 1~5에 순서대로 배정
}
