export type StoreCategory = 'ALL' | 'GOOGLE' | 'ONESTORE' | 'GALAXY' | 'APPLE';

export interface RankGameDetail {
  rank: number;
  name: string;
  benefitText: string;
  searchCount: string;
  discountRate: string;
  badge?: string;
}

export const STORE_TAB_OPTIONS: { id: StoreCategory; label: string; shortLabel: string }[] = [
  { id: 'ALL', label: '🏆 전체 결제 순위', shortLabel: '전체' },
  { id: 'GOOGLE', label: '🤖 구글 플레이', shortLabel: '구글' },
  { id: 'ONESTORE', label: '🛍️ 원스토어', shortLabel: '원스토어' },
  { id: 'GALAXY', label: '🌌 갤럭시 스토어', shortLabel: '갤스' },
  { id: 'APPLE', label: '🍎 앱스토어', shortLabel: '앱스토어' },
];

export const TOP_10_RANK_DATA: Record<StoreCategory, { title: string; list: RankGameDetail[] }> = {
  ALL: {
    title: '🏆 전체 결제순위',
    list: [
      { rank: 1, name: '쿠키런: 킹덤', benefitText: '스토어 15% 쿠폰 + 문화상품권 10% 우회 결제', searchCount: '12,450회', discountRate: '25% OFF', badge: 'TOP 1' },
      { rank: 2, name: '리니지M', benefitText: '신한 인앱결제 제휴카드 10% 청구할인', searchCount: '9,820회', discountRate: '18% OFF', badge: '인기' },
      { rank: 3, name: '오딘: 발할라 라이징', benefitText: '원스토어 수요일 15% 캐시백 이벤트', searchCount: '7,110회', discountRate: '15% OFF', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업:어라이즈', benefitText: '갤스 10% 쿠폰 + 삼성카드 5% 페이백', searchCount: '6,500회', discountRate: '12% OFF', badge: '급상승' },
      { rank: 5, name: '붕괴: 스타레일', benefitText: 'Play Points 골드등급 2배 적립', searchCount: '5,400회', discountRate: '10% 적립', badge: '유지' },
      { rank: 6, name: '원신', benefitText: '카카오페이 10% 즉시할인 행사', searchCount: '4,900회', discountRate: '10% OFF' },
      { rank: 7, name: 'AFK : 새로운 여정', benefitText: 'T멤버십 8% 차감 할인 혜택', searchCount: '4,100회', discountRate: '8% OFF' },
      { rank: 8, name: 'FC 모바일', benefitText: 'KB국민 노리2 체크카드 10% 할인', searchCount: '3,800회', discountRate: '8% OFF' },
      { rank: 9, name: '메이플스토리M', benefitText: '컬쳐랜드 우회 충전 5% 적립', searchCount: '3,200회', discountRate: '5% 적립' },
      { rank: 10, name: '승리의 여신: 니케', benefitText: '토스프라임 구독 서비스 4% 추가적립', searchCount: '2,900회', discountRate: '5% OFF' },
    ],
  },
  GOOGLE: {
    title: '🤖 구글 플레이 결제순위',
    list: [
      { rank: 1, name: '리니지M', benefitText: 'Play Points 다이아몬드 등급 2배 적립', searchCount: '8,900회', discountRate: '20% OFF', badge: '구글 1위' },
      { rank: 2, name: '쿠키런: 킹덤', benefitText: '구글 기프트코드 5% 할인 구매', searchCount: '7,200회', discountRate: '15% OFF', badge: '인기' },
      { rank: 3, name: '원신', benefitText: '포인트 적립 특별 이벤트', searchCount: '5,100회', discountRate: '12% 적립', badge: '상승' },
      { rank: 4, name: 'AFK : 새로운 여정', benefitText: '10% 인앱 결제 할인', searchCount: '4,300회', discountRate: '10% OFF', badge: 'NEW' },
      { rank: 5, name: 'FC 모바일', benefitText: 'Play Points 부스트 적립', searchCount: '3,900회', discountRate: '8% 적립', badge: '유지' },
      { rank: 6, name: '오딘: 발할라 라이징', benefitText: '구글 핀번 추가 적립', searchCount: '3,400회', discountRate: '8% 적립' },
      { rank: 7, name: '붕괴: 스타레일', benefitText: 'Play Points 1.5배 적립', searchCount: '3,100회', discountRate: '7% 적립' },
      { rank: 8, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', searchCount: '2,800회', discountRate: '6% OFF' },
      { rank: 9, name: '리니지W', benefitText: '통신사 소액결제 혜택', searchCount: '2,200회', discountRate: '5% OFF' },
      { rank: 10, name: '세븐나이츠 키우기', benefitText: '출석 쿠폰 지급 이벤트', searchCount: '1,900회', discountRate: '5% OFF' },
    ],
  },
  ONESTORE: {
    title: '🛍️ 원스토어 결제순위',
    list: [
      { rank: 1, name: '쿠키런: 킹덤', benefitText: '원스 수요일 30% 캐시백 행사', searchCount: '9,100회', discountRate: '30% OFF', badge: '원스 1위' },
      { rank: 2, name: '승리의 여신: 니케', benefitText: 'T멤버십 10% 차감 할인', searchCount: '6,400회', discountRate: '15% OFF', badge: '인기' },
      { rank: 3, name: '메이플스토리M', benefitText: '원스 쿠폰 20% 즉시 적용', searchCount: '4,800회', discountRate: '20% OFF', badge: '상승' },
      { rank: 4, name: '오딘: 발할라 라이징', benefitText: '매일 첫 결제 10% 할인', searchCount: '3,900회', discountRate: '10% OFF', badge: '유지' },
      { rank: 5, name: '기적의 검', benefitText: '원스 전용 포인트 적립', searchCount: '3,100회', discountRate: '10% 적립', badge: '유지' },
      { rank: 6, name: '삼국지 전략판', benefitText: '원스 캐시 10% 페이백', searchCount: '2,700회', discountRate: '10% OFF' },
      { rank: 7, name: '뮤 아크엔젤', benefitText: '하나 카드 원스 할인', searchCount: '2,100회', discountRate: '8% OFF' },
      { rank: 8, name: '바람의나라: 연', benefitText: 'T멤버십 전용 쿠폰', searchCount: '1,800회', discountRate: '8% OFF' },
      { rank: 9, name: '라그나로크M', benefitText: '주말 20% 할인 쿠폰', searchCount: '1,500회', discountRate: '7% OFF' },
      { rank: 10, name: '히트2', benefitText: '원스 1,000p 포인트 지급', searchCount: '1,200회', discountRate: '5% OFF' },
    ],
  },
  GALAXY: {
    title: '🌌 갤럭시 스토어 결제순위',
    list: [
      { rank: 1, name: '붕괴: 스타레일', benefitText: '갤스 10% 쿠폰 페이백', searchCount: '5,800회', discountRate: '15% OFF', badge: '갤스 1위' },
      { rank: 2, name: '원신', benefitText: '삼성 모바일카드 5% 청구할인', searchCount: '4,900회', discountRate: '12% OFF', badge: '인기' },
      { rank: 3, name: '쿠키런: 킹덤', benefitText: '출석체크 이벤트 페이백', searchCount: '3,800회', discountRate: '10% OFF', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업', benefitText: '갤스 1,000원 즉시 할인', searchCount: '3,100회', discountRate: '8% OFF', badge: 'NEW' },
      { rank: 5, name: '리니지W', benefitText: '갤스 멤버십 로열블루 적립', searchCount: '2,600회', discountRate: '7% 적립', badge: '유지' },
      { rank: 6, name: '붕괴3rd', benefitText: '삼성페이 5% 추가 할인', searchCount: '2,100회', discountRate: '5% OFF' },
      { rank: 7, name: '명조: 워더링 웨이브', benefitText: '갤스 전용 페이백 행사', searchCount: '1,900회', discountRate: '5% OFF' },
      { rank: 8, name: '검은사막 모바일', benefitText: '쿠폰 패키지 번들', searchCount: '1,500회', discountRate: '5% OFF' },
      { rank: 9, name: 'R2M', benefitText: '갤스 누적 결제 리워드', searchCount: '1,100회', discountRate: '5% OFF' },
      { rank: 10, name: '에픽세븐', benefitText: '갤스 멤버십 포인트 2배', searchCount: '900회', discountRate: '4% 적립' },
    ],
  },
  APPLE: {
    title: '🍎 앱스토어 결제순위',
    list: [
      { rank: 1, name: '원신', benefitText: '카카오페이 결제 10% 할인', searchCount: '6,200회', discountRate: '10% OFF', badge: '애플 1위' },
      { rank: 2, name: '붕괴: 스타레일', benefitText: '페이코 5% 포인트 적립', searchCount: '5,100회', discountRate: '8% 적립', badge: '인기' },
      { rank: 3, name: '쿠키런: 킹덤', benefitText: '앱스토어 첫 결제 이벤트', searchCount: '4,200회', discountRate: '8% OFF', badge: '상승' },
      { rank: 4, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', searchCount: '3,500회', discountRate: '7% OFF', badge: 'NEW' },
      { rank: 5, name: 'FC 모바일', benefitText: '애플페이 카드 추가 적립', searchCount: '2,900회', discountRate: '5% 적립', badge: '유지' },
      { rank: 6, name: '승리의 여신: 니케', benefitText: '카카오페이 전용 쿠폰', searchCount: '2,400회', discountRate: '5% OFF' },
      { rank: 7, name: 'AFK : 새로운 여정', benefitText: '토스페이 결제 할인', searchCount: '2,000회', discountRate: '5% OFF' },
      { rank: 8, name: '클래시 로얄', benefitText: '애플 기프트 카드 구매적용', searchCount: '1,600회', discountRate: '4% OFF' },
      { rank: 9, name: '로블록스', benefitText: '인앱 결제 특별 적립', searchCount: '1,300회', discountRate: '4% OFF' },
      { rank: 10, name: '꿈의 정원', benefitText: '페이코 3% 추가 적립', searchCount: '1,000회', discountRate: '3% 적립' },
    ],
  },
};