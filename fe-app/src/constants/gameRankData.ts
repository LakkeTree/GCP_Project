export interface RankGameDetail {
  rank: number;
  name: string;
  benefitText?: string;
  searchCount?: number;
  rankChange: 'UP' | 'DOWN' | 'SAME' | 'NEW' | string;
  rankChangeText: string;
  badge?: string;
  icon?: string;
}

export interface RankCategoryData {
  title: string;
  list: RankGameDetail[];
}

// 백엔드 API 연결 실패 시 사용할 기본 Fallback 데이터 (TOP 20)
export const FALLBACK_HOGAENG_RANK_DATA: RankCategoryData = {
  title: '🔥 호갱탈출 최근 7일간 인기 검색 순위',
  list: [
    { rank: 1, name: '쿠키런: 킹덤', benefitText: '최근 7일 검색 1위', rankChange: 'SAME', rankChangeText: '-', badge: '1위' },
    { rank: 2, name: '리니지M', benefitText: '인기 검색 게임', rankChange: 'UP', rankChangeText: '▲1', badge: '인기' },
    { rank: 3, name: '오딘: 발할라 라이징', benefitText: '검색량 급상승', rankChange: 'UP', rankChangeText: '▲2', badge: '상승' },
    { rank: 4, name: '나 혼자만 레벨업:어라이즈', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼1' },
    { rank: 5, name: '붕괴: 스타레일', benefitText: '주간 상위권 검색', rankChange: 'SAME', rankChangeText: '-' },
    { rank: 6, name: '원신', benefitText: '주간 상위권 검색', rankChange: 'UP', rankChangeText: '▲1' },
    { rank: 7, name: 'AFK : 새로운 여정', benefitText: '신규 검색 상위 진입', rankChange: 'NEW', rankChangeText: 'NEW', badge: 'NEW' },
    { rank: 8, name: 'FC 모바일', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼2' },
    { rank: 9, name: '메이플스토리M', benefitText: '주간 상위권 검색', rankChange: 'SAME', rankChangeText: '-' },
    { rank: 10, name: '승리의 여신: 니케', benefitText: '주간 상위권 검색', rankChange: 'UP', rankChangeText: '▲1' },
    { rank: 11, name: '젠레스 존 제로', benefitText: '주간 상위권 검색', rankChange: 'NEW', rankChangeText: 'NEW' },
    { rank: 12, name: '명조: 워더링 웨이브', benefitText: '주간 상위권 검색', rankChange: 'UP', rankChangeText: '▲3' },
    { rank: 13, name: '세븐나이츠 키우기', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼1' },
    { rank: 14, name: '바람의나라: 연', benefitText: '주간 상위권 검색', rankChange: 'SAME', rankChangeText: '-' },
    { rank: 15, name: '리니지W', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼2' },
    { rank: 16, name: '로블록스', benefitText: '주간 상위권 검색', rankChange: 'UP', rankChangeText: '▲1' },
    { rank: 17, name: '트릭컬 리바이브', benefitText: '주간 상위권 검색', rankChange: 'UP', rankChangeText: '▲4' },
    { rank: 18, name: '꿈의 정원', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼1' },
    { rank: 19, name: '라그나로크M', benefitText: '주간 상위권 검색', rankChange: 'SAME', rankChangeText: '-' },
    { rank: 20, name: '한게임 포커', benefitText: '주간 상위권 검색', rankChange: 'DOWN', rankChangeText: '▼3' },
  ],
};

// gameRankData.ts
export const fetchHogaengRankData = async (): Promise<RankCategoryData> => {
  try {
    // 1. 랭킹 API와 게임목록 API를 동시에 병렬(Promise.all) 로출
    const rankPromise = fetch('http://127.0.0.1:8000/ranks').then((r) => r.json());

    // 캐시된 게임 목록 확인
    let gameIconMap: Record<string, string> = {};
    const cachedGames = localStorage.getItem('cached_games_list');

    let gamesPromise: Promise<any>;
    if (cachedGames) {
      // 캐시 데이터가 있으면 API 요청 없이 즉시 사용
      const parsed = JSON.parse(cachedGames);
      parsed.forEach((g: any) => {
        if (g.name && g.icon_url) gameIconMap[g.name.trim().toLowerCase()] = g.icon_url;
      });
      gamesPromise = Promise.resolve(null);
    } else {
      gamesPromise = fetch('http://127.0.0.1:8000/games').then((r) => r.json());
    }

    const [rankResult, gamesResult] = await Promise.all([rankPromise, gamesPromise]);

    if (gamesResult && gamesResult.status === 'ok' && Array.isArray(gamesResult.data)) {
      localStorage.setItem('cached_games_list', JSON.stringify(gamesResult.data));
      gamesResult.data.forEach((g: any) => {
        if (g.name && g.icon_url) {
          gameIconMap[g.name.trim().toLowerCase()] = g.icon_url;
        }
      });
    }

    const rankList = Array.isArray(rankResult) ? rankResult : (rankResult.list || []);
    const updatedList = rankList.map((item: any) => {
      const cleanName = (item.name || '').trim().toLowerCase();
      return {
        ...item,
        icon: item.icon || gameIconMap[cleanName] || null
      };
    });

    return {
      title: rankResult.title || FALLBACK_HOGAENG_RANK_DATA.title,
      list: updatedList
    };
  } catch (err) {
    console.error('랭킹 데이터 로드 실패:', err);
    return FALLBACK_HOGAENG_RANK_DATA;
  }
};