export type OsType = 'ANDROID' | 'IOS';

export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
export const PAY_OPTIONS = ['네이버페이', '카카오페이', '페이코', '토스페이', '삼성페이', '애플페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프'
];

export const GOOGLE_PLAY_TIERS = [
  { label: '브론즈 (기본 1.0% 적립)', value: 'BRONZE' },
  { label: '실버 (1.1% 적립)', value: 'SILVER' },
  { label: '골드 (1.3% 적립)', value: 'GOLD' },
  { label: '플래티넘 (1.6% 적립)', value: 'PLATINUM' },
  { label: '다이아몬드 (최상위 2.0% 적립)', value: 'DIAMOND' },
];

export const GALAXY_STORE_TIERS = [
  { label: '기본 / 상시 (0.2% 적립)', value: 'STANDARD' },
  { label: '프레스티지 (1.1% 적립)', value: 'PRESTIGE' },
  { label: '로열블루 (2.1% 적립)', value: 'ROYAL_BLUE' },
];

export const SPECIAL_CARD_OPTIONS = [
  { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' },
  { label: '[신한] LineageM 신한카드 (인앱 10% 할인)', value: 'SHINHAN_CARD_LINEAGE' },
  { label: '[신한] LineageM 신한 체크카드 (인앱 5% 할인)', value: 'SHINHAN_CARD_CHECK' },
  { label: '[삼성] 삼성 모바일 플러스 (갤스 5% 할인)', value: 'SAMSUNG_CARD_MOBILE' },
  { label: '[삼성] 삼성 iD SELECT ON (인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_SELECT' },
  { label: '[삼성] 삼성 iD GLOBAL (해외/인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_GLOBAL' },
  { label: '[국민] KB국민 노리2 체크카드 (Play) (10% 할인)', value: 'KB_KOOKMIN_CARD_NORI' },
  { label: '[농협] NH농협 zgm.play (10% 할인)', value: 'NH_NONGHYUP_CARD_PLAY' },
  { label: '[농협] NH농협 zgm.streaming (10% 할인)', value: 'NH_NONGHYUP_CARD_STREAMING' },
  { label: '[하나] 원스토어 1 하나카드 (원스토어 2% 할인)', value: 'HANA_CARD_ONESTORE' },
];