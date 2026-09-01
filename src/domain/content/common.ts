export const COMMON_WARMUP = [
  { name: "제자리 걷기", prescription: "60초" },
  { name: "팔 앞뒤로 크게 돌리기", prescription: "앞으로 10회 + 뒤로 10회" },
  { name: "팔 벌려 가슴 열고 닫기", prescription: "10~15회" },
  { name: "골반 원 그리기", prescription: "좌우 각 8~10회" },
  { name: "맨몸 굿모닝", prescription: "10회" },
  { name: "맨몸 스쿼트", prescription: "천천히 8~10회" },
] as const

export const GLOBAL_SAFETY_STOP_SIGNALS = [
  "관절 안쪽의 날카로운 통증",
  "갑작스러운 허리 통증",
  "어깨가 걸리거나 찌르는 통증",
  "특정 각도에서 날카로운 무릎 통증",
  "저림",
  "감각 이상",
  "심한 어지럼증",
  "흉통",
] as const

export const BEGINNER_SESSION_RULES = [
  "공통 워밍업부터 시작한다.",
  "현재 레벨보다 쉬운 동작으로 워밍업 세트를 한다.",
  "본운동은 기본 3세트다.",
  "매 세트 실패할 필요 없다.",
  "자세가 무너지면 반복 수보다 자세를 우선한다.",
] as const

export const ASSESSMENT_CAPS = {
  adaptationSessionCount: 6,
  adaptationSetCount: 2,
  standardSetCount: 3,
  qualifyingSessionCount: 2,
} as const
