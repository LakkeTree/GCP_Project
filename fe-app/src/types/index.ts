// 백엔드 연동 데이터 스키마
export interface RouteRequest {
  platform: string;
  amount: number;
  is_first_pay: boolean;
  payment_methods: string[];
  game: string;
  membership_tier?: string;
  has_subscription?: boolean;
  has_prev_spend?: boolean;
  has_pre_applied?: boolean;
  use_game_benefits?: boolean;
}

export interface RouteStep {
  layer: string;
  provider: string;
  type: string;
  applied_amount: number;
  giftcard_combo?: number[];
  item_or_event_name?: string;
  condition_raw_text?: string;
  target_game?: string;
}

export interface RecommendedRoute {
  route_type: string;
  base_amount: number;
  final_paid_amount: number;
  reward_total: number;
  net_cost: number;
  leftover_balance: number;
  steps: RouteStep[];
}

export interface BackendResponse {
  routes: RecommendedRoute[];
  warnings: Array<{ benefit_id: string; provider: string; conditions: string[] }>;
}

// 프론트엔드 UI 카드 출력용 타입
export interface StepDetail {
  layerName: string;
  providerName: string;
  type: string;
  amount: number;
  formattedAmountText: string;
  eventName: string;
  conditionText: string;
  comboText?: string;
  targetGame: string;
  isGameSpecific: boolean;
}

export interface OptimizationResult {
  rank: number;
  title: string;
  platform: string;
  original_price: number;
  actual_payment_price: number;
  immediate_discount_total: number;
  final_price: number;
  reward_point: number;
  total_benefit_amount: number;
  discount_rate: number;
  steps: StepDetail[];
  discount_steps: StepDetail[];
  reward_steps: StepDetail[];
  guide_text: string;
  rawRoute: RecommendedRoute;
}

export interface ApiResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data: OptimizationResult[];
}

// 사용자 입력 폼 데이터 타입
export type OsType = 'ANDROID' | 'IOS';

export interface FormData {
  gameTitle: string;
  osType: OsType;
  androidStores: string[];
  amount: number | '';
  isFirstPayment: boolean;
  hasPreApplied: boolean;
  useGameBenefits: boolean;
  googlePlayTier: string;
  galaxyStoreTier: string;
  useCarriers: boolean;
  carriers: string[];
  usePays: boolean;
  pays: string[];
  useVoucherBypasses: boolean;
  voucherBypasses: string[];
  useSpecialOptions: boolean;
  subscriptions: string[];
  hasPrevSpend: boolean;
  isPcVersion: boolean;
  selectedSpecialCard: string;
}

// 사용자 및 인증 관련 타입
export interface User {
  email: string;
  name?: string;
}

// 랭킹 아이템 타입
export interface RankItem {
  id: number;
  rank: number;
  title: string;
  subText?: string;
  badgeText?: string;
  changeStatus?: 'UP' | 'DOWN' | 'SAME' | 'NEW'; // 순위 변동 상태 (옵션)
}

export interface GamerRankData {
  topPaymentMethods: RankItem[];
  topGames: RankItem[];
  topPlatforms: RankItem[];
}