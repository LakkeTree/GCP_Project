export interface GameMeta {
  name: string;
  imageUrl?: string;        // 실제 이미지 경로 (예: /images/games/cookierun.png)
  emojiFallback: string;   // 이미지가 없을 때 띄울 대체 이모티콘
  category: string;
  stores: string[];
}

export interface PayMeta {
  name: string;
  logoUrl?: string;
  emojiFallback: string;
}

// 1. 게임 이미지 및 정보 매핑
export const GAME_ASSETS: Record<string, GameMeta> = {
  '쿠키런: 킹덤': {
    name: '쿠키런: 킹덤',
    imageUrl: '/images/games/cookierun.png', // 이미지를 준비하면 경로 입력
    emojiFallback: '🍪',
    category: '수집형 RPG',
    stores: ['구글', '원스', '갤스', '앱스토어'],
  },
  '리니지M': {
    name: '리니지M',
    imageUrl: '/images/games/lineagem.png',
    emojiFallback: '⚔️',
    category: 'MMORPG',
    stores: ['구글', '앱스토어'],
  },
  '원신': {
    name: '원신',
    imageUrl: '/images/games/genshin.png',
    emojiFallback: '✨',
    category: '오픈월드 RPG',
    stores: ['구글', '갤스', '앱스토어'],
  },
};

// 2. 결제 수단(페이/카드) 로고 매핑
export const PAY_ASSETS: Record<string, PayMeta> = {
  '네이버페이': {
    name: '네이버페이',
    logoUrl: '/images/pays/naverpay.png',
    emojiFallback: '💸',
  },
  '카카오페이': {
    name: '카카오페이',
    logoUrl: '/images/pays/kakaopay.png',
    emojiFallback: '💛',
  },
  '토스페이': {
    name: '토스페이',
    logoUrl: '/images/pays/tosspay.png',
    emojiFallback: '🔵',
  },
};