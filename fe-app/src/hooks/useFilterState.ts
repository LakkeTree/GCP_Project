import { useState, useEffect } from 'react';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
} from '../constants/searchOptions';

const FILTER_STORAGE_KEY = 'user_search_filter_settings';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface CardOption {
  label: string;
  value: string;
}

export interface FilterState {
  osType: OsType;
  androidStores: string[];
  googlePlayTier: string;
  galaxyStoreTier: string;
  isPcVersion: boolean;
  useTMembership: boolean;
  useNaverMembership: boolean;
  useTossPrime: boolean;
  useGameBenefits: boolean;
  hasPreApplied: boolean;
  isFirstPayment: boolean;
  useCarriers: boolean;
  carriers: string[];
  usePays: boolean;
  pays: string[];
  useVoucherBypasses: boolean;
  voucherBypasses: string[];
  useSpecialOptions: boolean;
  selectedSpecialCard: string;
  hasPrevSpend: boolean;
  favoriteGames: string[];
  recentGames: string[];
}

export const emptyFilterState: FilterState = {
  osType: 'ANDROID',
  androidStores: [],
  googlePlayTier: 'BRONZE',
  galaxyStoreTier: 'STANDARD',
  isPcVersion: false,
  useTMembership: false,
  useNaverMembership: false,
  useTossPrime: false,
  useGameBenefits: false,
  hasPreApplied: false,
  isFirstPayment: false,
  useCarriers: false,
  carriers: [],
  usePays: false,
  pays: [],
  useVoucherBypasses: false,
  voucherBypasses: [],
  useSpecialOptions: false,
  selectedSpecialCard: 'NONE',
  hasPrevSpend: false,
  favoriteGames: ['쿠키런: 킹덤', '원신', '붕괴: 스타레일'],
  recentGames: [],
};

export function useFilterState(startEmpty: boolean = false) {
  const [filter, setFilter] = useState<FilterState>(() => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    let savedObj: Partial<FilterState> = {};
    if (saved) {
      try {
        savedObj = JSON.parse(saved);
      } catch (e) {
        console.error('필터 로드 실패:', e);
      }
    }

    if (startEmpty) {
      return {
        ...emptyFilterState,
        favoriteGames: savedObj.favoriteGames || emptyFilterState.favoriteGames,
        recentGames: savedObj.recentGames || emptyFilterState.recentGames,
      };
    }

    return { ...emptyFilterState, ...savedObj };
  });

  // 💡 카드 목록 동적 수급 및 고유 정제 상태
  const [cardOptions, setCardOptions] = useState<CardOption[]>([
    { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' },
  ]);

  // 💡 API에서 카드를 수급하여 이상한 혜택 문구 없이 카드사명으로만 정제
  useEffect(() => {
    fetch(`${API_BASE_URL}/payments`)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          const options: CardOption[] = [
            { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' },
          ];

          // 💡 비카드 수단 제외 키워드
          const EXCLUDE_KEYWORDS = [
            'GIFTCARD', 'GIFT_CARD', 'SSG', '11STREET', 'GMARKET',
            'CONVENIENCE', 'CU_', 'GS25', 'SEVEN', 'ZEROPIN', 'NAVER_STORE', 'APPLE_GIFT',
            'CREDIT_CHECK_CARD', 'CULTURE', 'BOOK', 'TRANSFER', 'BANK', 'CARRIER', 'TELECOM'
          ];

          // 💡 카드 상품명이 아니거나 더미 혜택 제목 제외 키워드
          const EXCLUDE_TITLES = [
            'CREDIT CHECK CARD', '삼성페이', '결제수단별', '기본 적립률', '기본/이벤트 혜택',
            '페이백', '첫 결제', '월간 적립', '100%'
          ];

          const addedCardNames = new Set<string>();

          result.data.forEach((m: any) => {
            const codeUpper = (m.code || '').toUpperCase();
            const catUpper = (m.category || '').toUpperCase();

            const isCard =
              catUpper === 'CARD' ||
              codeUpper.endsWith('_CARD') ||
              codeUpper.includes('SHINHAN') ||
              codeUpper.includes('KB') ||
              codeUpper.includes('HANA') ||
              codeUpper.includes('NH') ||
              codeUpper.includes('SAMSUNG');

            const isExcluded = EXCLUDE_KEYWORDS.some((kw) => codeUpper.includes(kw));

            if (isCard && !isExcluded) {
              // c.benefits 안의 상세 카드 상품명(b.title) 또는 m.name 추출
              if (m.benefits && m.benefits.length > 0) {
                m.benefits.forEach((b: any) => {
                  const cardName = (b.title || m.name).trim();
                  const isTitleExcluded = EXCLUDE_TITLES.some((t) => cardName.includes(t));

                  if (cardName && !addedCardNames.has(cardName) && !isTitleExcluded) {
                    addedCardNames.add(cardName);
                    options.push({
                      label: cardName,  // 예: "원스토어1 하나카드", "KB국민 노리2 체크카드"
                      value: m.code,
                    });
                  }
                });
              } else {
                const cardName = m.name.trim();
                const isTitleExcluded = EXCLUDE_TITLES.some((t) => cardName.includes(t));

                if (cardName && !addedCardNames.has(cardName) && !isTitleExcluded) {
                  addedCardNames.add(cardName);
                  options.push({
                    label: cardName,
                    value: m.code,
                  });
                }
              }
            }
          });

          setCardOptions(options);
        }
      })
      .catch((err) => console.error('카드 옵션 로드 실패:', err));
  }, []);

  const saveFilterSettings = () => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
    alert('기본 검색 조건 및 설정이 성공적으로 저장되었습니다!');
  };

  const loadSavedFilter = () => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFilter((prev) => ({
          ...prev,
          ...parsed,
        }));
        return true;
      } catch (e) {
        console.error('필터 로드 실패:', e);
      }
    }
    return false;
  };

  const addFavoriteGame = (gameName: string) => {
    setFilter((prev) => {
      if (prev.favoriteGames.includes(gameName)) return prev;
      if (prev.favoriteGames.length >= 10) {
        alert('즐겨찾기는 최대 10개까지만 등록할 수 있습니다.');
        return prev;
      }
      return { ...prev, favoriteGames: [...prev.favoriteGames, gameName] };
    });
  };

  const removeFavoriteGame = (gameName: string) => {
    setFilter((prev) => ({
      ...prev,
      favoriteGames: prev.favoriteGames.filter((g) => g !== gameName),
    }));
  };

  const addRecentGame = (gameName: string) => {
    if (!gameName.trim()) return;
    setFilter((prev) => {
      const filtered = (prev.recentGames || []).filter((g: string) => g !== gameName.trim());
      const updatedList = [gameName.trim(), ...filtered].slice(0, 5);
      const updatedState = { ...prev, recentGames: updatedList };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updatedState));
      return updatedState;
    });
  };

  const removeRecentGame = (gameName: string) => {
    setFilter((prev) => {
      const updated = { ...prev, recentGames: prev.recentGames.filter((g) => g !== gameName) };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const selectAll = () => {
    setFilter((prev) => ({
      ...prev,
      androidStores: [...ANDROID_STORE_OPTIONS],
      useCarriers: true,
      carriers: [...CARRIER_OPTIONS],
      usePays: true,
      pays: [...PAY_OPTIONS],
      useVoucherBypasses: true,
      voucherBypasses: [...VOUCHER_OPTIONS],
      useGameBenefits: true,
      hasPreApplied: true,
      isFirstPayment: true,
    }));
  };

// 💡 최소 1개 필수 유지 항목 체크
  const toggleArrayItem = (key: 'androidStores' | 'carriers' | 'pays' | 'voucherBypasses', item: string) => {
    setFilter((prev) => {
      const list = prev[key];
      const isSelected = list.includes(item);

      // 🚫 1. 스토어 최소 1개 유지 방어
      if (key === 'androidStores' && isSelected && list.length <= 1) {
        alert('이용 가능한 스토어는 최소 1개 이상 선택해야 합니다.');
        return prev;
      }

      // 🚫 2. 보유 결제수단 총합 최소 1개 유지 방어
      if (isSelected && (key === 'carriers' || key === 'pays' || key === 'voucherBypasses')) {
        const totalSelected =
          (prev.useCarriers ? prev.carriers.length : 0) +
          (prev.usePays ? prev.pays.length : 0) +
          (prev.useVoucherBypasses ? prev.voucherBypasses.length : 0);

        if (totalSelected <= 1) {
          alert('보유 결제 수단은 최소 1개 이상 선택해야 합니다.');
          return prev;
        }
      }

      const nextList = isSelected ? list.filter((i) => i !== item) : [...list, item];
      return { ...prev, [key]: nextList };
    });
  };

  // 💡 [모든 선택 취소] 시에도 기본 스토어 1개와 기본 결제수단 1개는 남겨두도록 설정
  const deselectAll = () => {
    setFilter((prev) => ({
      ...prev,
      androidStores: ['구글 플레이 스토어'], // 기본 스토어 1개 유지
      useCarriers: false,
      carriers: [],
      usePays: true,
      pays: ['카카오페이'], // 기본 결제수단 1개 유지
      useVoucherBypasses: false,
      voucherBypasses: [],
      useGameBenefits: false,
      hasPreApplied: false,
      isFirstPayment: false,
      useTMembership: false,
      useNaverMembership: false,
      useTossPrime: false,
      useSpecialOptions: false,
      selectedSpecialCard: 'NONE',
      hasPrevSpend: false,
    }));
  };

  return {
    filter,
    setFilter,
    cardOptions, // 💡 이제 카드 옵션이 훅에서 기본으로 수급됩니다!
    saveFilterSettings,
    loadSavedFilter,
    addFavoriteGame,
    removeFavoriteGame,
    addRecentGame,
    removeRecentGame,
    selectAll,
    deselectAll,
    toggleArrayItem,
  };
}