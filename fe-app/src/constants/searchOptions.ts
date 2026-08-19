export type OsType = 'ANDROID' | 'IOS';

// ==========================================
// 1. UI 선택 필터 옵션 상수
// ==========================================
export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
// 💡 일반(비회원) 토스페이는 게임 결제에 실질적인 적립률이 없어(0%), 토스프라임
//    회원 전용 적립만 계산에 의미가 있다. 그래서 "토스페이"를 별도 체크박스로
//    가입 여부를 다시 묻는 대신, 선택지 자체를 "토스페이 프라임"으로 표기한다.
export const PAY_OPTIONS = ['네이버페이', '카카오페이', '페이코', '토스페이 프라임', '삼성페이', '애플페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프',
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

export const SUBSCRIPTION_OPTIONS = [
  'T멤버십 (원스토어 10% 할인/적립)',
];

export const POPULAR_GAMES = [
  { name: '쿠키런: 킹덤' },
  { name: '리니지M' },
  { name: '원신' },
  { name: '붕괴: 스타레일' },
  { name: '오딘: 발할라 라이징' },
  { name: '나 혼자만 레벨업:어라이즈' },
  { name: 'AFK : 새로운 여정' },
  { name: 'FC 모바일' },
];

// ==========================================
// 2. 프론트엔드 - 백엔드 코드 매핑표
// ==========================================
export const CARD_CODE_MAP: Record<string, string> = {
  'SHINHAN_CARD_LINEAGE': 'SHINHAN_CARD',
  'SHINHAN_CARD_CHECK': 'SHINHAN_CARD',
  'SAMSUNG_CARD_MOBILE': 'SAMSUNG_CARD',
  'SAMSUNG_CARD_ID_SELECT': 'SAMSUNG_CARD',
  'SAMSUNG_CARD_ID_GLOBAL': 'SAMSUNG_CARD',
  'KB_KOOKMIN_CARD_NORI': 'KB_KOOKMIN_CARD',
  'NH_NONGHYUP_CARD_PLAY': 'NH_NONGHYUP_CARD',
  'NH_NONGHYUP_CARD_STREAMING': 'NH_NONGHYUP_CARD',
  'HANA_CARD_ONESTORE': 'HANA_CARD',
};

// 💡 useFilterState.ts가 동적으로 만드는 카드 옵션의 value는
//    "카드사코드::혜택id" 형태(예: "NH_NONGHYUP_CARD::BNF_CARD_NH_99945c93")다.
//    같은 카드사 밑에 있는 서로 다른 카드 상품(혜택)을 <select>가 구분할 수 있게
//    하려고 붙인 접미사이고, 백엔드는 카드사 코드만 이해하므로(계산은 카드사+플랫폼
//    단위로만 이루어짐) 전송 직전엔 항상 이 함수로 카드사 코드만 잘라내야 한다.
//    "::"가 없는 값(NONE, 위 CARD_CODE_MAP의 레거시 코드 등)은 그대로/매핑된 값을 반환한다.
export function resolveCardProviderCode(selectedSpecialCard: string): string {
  if (CARD_CODE_MAP[selectedSpecialCard]) return CARD_CODE_MAP[selectedSpecialCard];
  const providerCode = selectedSpecialCard.split('::')[0];
  return CARD_CODE_MAP[providerCode] || providerCode;
}

export const PLATFORM_CODE_MAP: Record<string, string> = {
  '구글 플레이 스토어': 'GOOGLE_PLAY',
  '원스토어': 'ONE_STORE',
  '갤럭시 스토어': 'GALAXY_STORE',
  '앱스토어': 'APP_STORE',
};

export const PAYMENT_METHOD_MAP: Record<string, string> = {
  'SKT': 'SKT',
  'KT': 'KT',
  'LGU+': 'LGU_PLUS',
  '네이버페이': 'NAVER_PAY',
  '카카오페이': 'KAKAO_PAY',
  '페이코': 'PAYCO',
  '토스페이 프라임': 'TOSS_PAY',
  '삼성페이': 'SAMSUNG_PAY',
  '애플페이': 'APPLE_PAY',
  '컬쳐랜드(우회/캐시)': 'CULTURELAND_CASH',
  '구글 핀번 기프트코드': 'GOOGLE_PLAY_GIFTCARD',
  '원스토어 핀번 기프트코드': 'ONESTORE_GIFTCARD',
  '북앤라이프': 'BOOKNLIFE_VOUCHER',
  '구글 플레이 스토어': 'GOOGLE_PLAY_STORE',
  '갤럭시 스토어': 'GALAXY_STORE',
  '원스토어': 'ONE_STORE',
  '앱스토어': 'APP_STORE',
  '신한카드': 'SHINHAN_CARD',
  '삼성카드': 'SAMSUNG_CARD',
  'KB국민카드': 'KB_KOOKMIN_CARD',
  'NH농협카드': 'NH_NONGHYUP_CARD',
  '하나카드': 'HANA_CARD',
  'ZEROPIN': '제로핀(기프트코드)',
  'CU_CONVENIENCE_STORE': 'CU 편의점',
  'GS25_CONVENIENCE_STORE': 'GS25 편의점',
  'SEVEN_ELEVEN': '세븐일레븐',
  'GMARKET': 'G마켓',
  '11STREET': '11번가',
  'SSG_COM': 'SSG.COM',
  'GOOGLE_PLAY_NAVER_STORE': '네이버 브랜드스토어',
};

export const LAYER_NAME_MAP: Record<string, string> = {
  STORE_COUPON: '스토어 쿠폰',
  PAYMENT_PG: '간편결제/통신사',
  PAYMENT_E_PAY: '간편결제/통신사',
  CARD_ISSUER: '카드사 혜택',
  GIFT_CARD: '상품권 우회',
  ONLINE_CARD_ON_GIFTCARD: '상품권 카드결제 혜택',
  STORE_BASE_REWARD: '스토어 기본 적립',
};

// 백엔드 제공처 영문 코드를 프론트엔드 한글 명칭으로 변환하는 역매핑 객체
export const REVERSE_PAYMENT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_METHOD_MAP).map(([k, v]) => [v, k])
);

// ==========================================
// 3. API 엔드포인트 및 공통 헬퍼 유틸리티
// ==========================================
export const BACKEND_API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/routes';

export const getGameIcon = (title: string): string => {
  if (title.includes('쿠키런')) return '🍪';
  if (title.includes('리니지')) return '⚔️';
  if (title.includes('오딘')) return '🛡️';
  if (title.includes('레벨업')) return '🗡️';
  if (title.includes('스타레일')) return '🚀';
  if (title.includes('원신')) return '✨';
  if (title.includes('AFK')) return '🏹';
  if (title.includes('FC')) return '⚽';
  if (title.includes('메이플')) return '🍁';
  if (title.includes('니케')) return '🔫';
  return '🎮';
};
 
export const getGameStores = (title: string): string[] => {
  if (title.includes('리니지M') || title.includes('FC')) return ['구글', '앱스토어'];
  if (title.includes('오딘')) return ['구글', '원스', '앱스토어'];
  if (title.includes('트릭컬')) return ['구글', '갤스', '원스'];
  return ['구글', '원스', '갤스', '앱스토어'];
};