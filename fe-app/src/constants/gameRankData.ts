export type StoreCategory = 'HOGAENG' | 'GOOGLE' | 'ONESTORE' | 'GALAXY' | 'APPLE';

export interface RankGameDetail {
  rank: number;
  name: string;
  benefitText: string;
  rankChange: 'UP' | 'DOWN' | 'SAME' | 'NEW' | string;
  rankChangeText: string;
  badge?: string;
  icon?: string;
}

export interface RankCategoryData {
  title: string;
  list: RankGameDetail[];
}

export const STORE_TAB_OPTIONS: { id: StoreCategory; label: string; shortLabel: string }[] = [
  { id: 'HOGAENG', label: '🔥 호갱탈출 7일간 검색 순위', shortLabel: '호갱탈출 검색' },
  { id: 'GOOGLE', label: '🤖 구글 플레이 7일간 결제 순위', shortLabel: '구글 결제' },
  { id: 'ONESTORE', label: '🛍️ 원스토어 7일간 결제 순위', shortLabel: '원스토어 결제' },
  { id: 'GALAXY', label: '🌌 갤럭시 스토어 7일간 결제 순위', shortLabel: '갤스 결제' },
  { id: 'APPLE', label: '🍎 앱스토어 7일간 결제 순위', shortLabel: '앱스토어 결제' },
];

// 백엔드 API가 준비되지 않았을 때 작동하는 기본 Fallback 데이터
export const FALLBACK_RANK_DATA: Record<StoreCategory, RankCategoryData> = {
  HOGAENG: {
    title: '🔥 호갱탈출 7일간 검색 순위',
    list: [
      { rank: 1, name: '쿠키런: 킹덤', benefitText: '스토어 15% 쿠폰 + 문화상품권 10% 우회 결제', rankChange: 'SAME', rankChangeText: '-', badge: '검색 1위' },
      { rank: 2, name: '리니지M', benefitText: '신한 인앱결제 제휴카드 10% 청구할인', rankChange: 'UP', rankChangeText: '▲1', badge: '인기' },
      { rank: 3, name: '오딘: 발할라 라이징', benefitText: '원스토어 수요일 15% 캐시백 이벤트', rankChange: 'UP', rankChangeText: '▲2', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업:어라이즈', benefitText: '갤스 10% 쿠폰 + 삼성카드 5% 페이백', rankChange: 'DOWN', rankChangeText: '▼1', badge: '급상승' },
      { rank: 5, name: '붕괴: 스타레일', benefitText: 'Play Points 골드등급 2배 적립', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 6, name: '원신', benefitText: '카카오페이 10% 즉시할인 행사', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 7, name: 'AFK : 새로운 여정', benefitText: 'T멤버십 8% 차감 할인 혜택', rankChange: 'NEW', rankChangeText: 'NEW' },
      { rank: 8, name: 'FC 모바일', benefitText: 'KB국민 노리2 체크카드 10% 할인', rankChange: 'DOWN', rankChangeText: '▼2' },
      { rank: 9, name: '메이플스토리M', benefitText: '컬쳐랜드 우회 충전 5% 적립', rankChange: 'SAME', rankChangeText: '-' },
      { rank: 10, name: '승리의 여신: 니케', benefitText: '토스프라임 구독 서비스 4% 추가적립', rankChange: 'UP', rankChangeText: '▲1' },
    ],
  },
  GOOGLE: {
    title: '🤖 구글 플레이 7일간 결제 순위 (스토어 크롤링)',
    list: [
      { rank: 1, name: '리니지M', benefitText: 'Play Points 다이아몬드 등급 2배 적립', rankChange: 'SAME', rankChangeText: '-', badge: '매출 1위' },
      { rank: 2, name: '쿠키런: 킹덤', benefitText: '구글 기프트코드 5% 할인 구매', rankChange: 'UP', rankChangeText: '▲1', badge: '인기' },
      { rank: 3, name: '원신', benefitText: '포인트 적립 특별 이벤트', rankChange: 'UP', rankChangeText: '▲1', badge: '상승' },
      { rank: 4, name: 'AFK : 새로운 여정', benefitText: '10% 인앱 결제 할인', rankChange: 'NEW', rankChangeText: 'NEW', badge: 'NEW' },
      { rank: 5, name: 'FC 모바일', benefitText: 'Play Points 부스트 적립', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 6, name: '오딘: 발할라 라이징', benefitText: '구글 핀번 추가 적립', rankChange: 'DOWN', rankChangeText: '▼2' },
      { rank: 7, name: '붕괴: 스타레일', benefitText: 'Play Points 1.5배 적립', rankChange: 'DOWN', rankChangeText: '▼1' },
      { rank: 8, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', rankChange: 'SAME', rankChangeText: '-' },
      { rank: 9, name: '리니지W', benefitText: '통신사 소액결제 혜택', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 10, name: '세븐나이츠 키우기', benefitText: '출석 쿠폰 지급 이벤트', rankChange: 'DOWN', rankChangeText: '▼1' },
    ],
  },
  ONESTORE: {
    title: '🛍️ 원스토어 7일간 결제 순위 (스토어 크롤링)',
    list: [
      { rank: 1, name: '쿠키런: 킹덤', benefitText: '원스 수요일 30% 캐시백 행사', rankChange: 'SAME', rankChangeText: '-', badge: '매출 1위' },
      { rank: 2, name: '승리의 여신: 니케', benefitText: 'T멤버십 10% 차감 할인', rankChange: 'UP', rankChangeText: '▲2', badge: '인기' },
      { rank: 3, name: '메이플스토리M', benefitText: '원스 쿠폰 20% 즉시 적용', rankChange: 'DOWN', rankChangeText: '▼1', badge: '상승' },
      { rank: 4, name: '오딘: 발할라 라이징', benefitText: '매일 첫 결제 10% 할인', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 5, name: '기적의 검', benefitText: '원스 전용 포인트 적립', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 6, name: '삼국지 전략판', benefitText: '원스 캐시 10% 페이백', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 7, name: '뮤 아크엔젤', benefitText: '하나 카드 원스 할인', rankChange: 'DOWN', rankChangeText: '▼1' },
      { rank: 8, name: '바람의나라: 연', benefitText: 'T멤버십 전용 쿠폰', rankChange: 'SAME', rankChangeText: '-' },
      { rank: 9, name: '라그나로크M', benefitText: '주말 20% 할인 쿠폰', rankChange: 'UP', rankChangeText: '▲3' },
      { rank: 10, name: '히트2', benefitText: '원스 1,000p 포인트 지급', rankChange: 'DOWN', rankChangeText: '▼2' },
    ],
  },
  GALAXY: {
    title: '🌌 갤럭시 스토어 7일간 결제 순위 (스토어 크롤링)',
    list: [
      { rank: 1, name: '붕괴: 스타레일', benefitText: '갤스 10% 쿠폰 페이백', rankChange: 'SAME', rankChangeText: '-', badge: '매출 1위' },
      { rank: 2, name: '원신', benefitText: '삼성 모바일카드 5% 청구할인', rankChange: 'UP', rankChangeText: '▲1', badge: '인기' },
      { rank: 3, name: '쿠키런: 킹덤', benefitText: '출석체크 이벤트 페이백', rankChange: 'DOWN', rankChangeText: '▼1', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업', benefitText: '갤스 1,000원 즉시 할인', rankChange: 'NEW', rankChangeText: 'NEW', badge: 'NEW' },
      { rank: 5, name: '리니지W', benefitText: '갤스 멤버십 로열블루 적립', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 6, name: '붕괴3rd', benefitText: '삼성페이 5% 추가 할인', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 7, name: '명조: 워더링 웨이브', benefitText: '갤스 전용 페이백 행사', rankChange: 'DOWN', rankChangeText: '▼2' },
      { rank: 8, name: '검은사막 모바일', benefitText: '쿠폰 패키지 번들', rankChange: 'SAME', rankChangeText: '-' },
      { rank: 9, name: 'R2M', benefitText: '갤스 누적 결제 리워드', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 10, name: '에픽세븐', benefitText: '갤스 멤버십 포인트 2배', rankChange: 'DOWN', rankChangeText: '▼1' },
    ],
  },
  APPLE: {
    title: '🍎 앱스토어 7일간 결제 순위 (스토어 크롤링)',
    list: [
      { rank: 1, name: '원신', benefitText: '카카오페이 결제 10% 할인', rankChange: 'SAME', rankChangeText: '-', badge: '매출 1위' },
      { rank: 2, name: '붕괴: 스타레일', benefitText: '페이코 5% 포인트 적립', rankChange: 'UP', rankChangeText: '▲1', badge: '인기' },
      { rank: 3, name: '쿠키런: 킹덤', benefitText: '앱스토어 첫 결제 이벤트', rankChange: 'DOWN', rankChangeText: '▼1', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', rankChange: 'NEW', rankChangeText: 'NEW', badge: 'NEW' },
      { rank: 5, name: 'FC 모바일', benefitText: '애플페이 카드 추가 적립', rankChange: 'SAME', rankChangeText: '-', badge: '유지' },
      { rank: 6, name: '승리의 여신: 니케', benefitText: '카카오페이 전용 쿠폰', rankChange: 'UP', rankChangeText: '▲2' },
      { rank: 7, name: 'AFK : 새로운 여정', benefitText: '토스페이 결제 할인', rankChange: 'DOWN', rankChangeText: '▼1' },
      { rank: 8, name: '클래시 로얄', benefitText: '애플 기프트 카드 구매적용', rankChange: 'SAME', rankChangeText: '-' },
      { rank: 9, name: '로블록스', benefitText: '인앱 결제 특별 적립', rankChange: 'UP', rankChangeText: '▲1' },
      { rank: 10, name: '꿈의 정원', benefitText: '페이코 3% 추가 적립', rankChange: 'DOWN', rankChangeText: '▼2' },
    ],
  },
};

// 실시간 DB 데이터 Fetch 유틸리티 함수
export const fetchRankData = async (category: StoreCategory): Promise<RankCategoryData> => {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  
  try {
    const res = await fetch(`${API_BASE}/ranks?category=${category}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error('DB 랭킹 조회 실패');
    
    const data = await res.json();
    return data;
  } catch (err) {
    // API 연결 실패 시 Fallback 데이터로 안전하게 복구
    return FALLBACK_RANK_DATA[category];
  }
}; 