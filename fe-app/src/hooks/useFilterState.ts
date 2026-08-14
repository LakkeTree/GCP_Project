import { useState } from 'react';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
} from '../constants/searchOptions';

const FILTER_STORAGE_KEY = 'user_search_filter_settings';

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

  // 💡 즐겨찾기 추가 (최대 10개 제한)
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

  // 💡 최근 검색어 추가 (중복 제거 후 최신순 최대 5개 제한)
  const addRecentGame = (gameName: string) => {
    if (!gameName.trim()) return;
    setFilter((prev) => {
      const filtered = (prev.recentGames || []).filter((g: string) => g !== gameName.trim());
      const updatedList = [gameName.trim(), ...filtered].slice(0, 5); // 최근 검색 5개 제한
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

  const deselectAll = () => {
    setFilter((prev) => ({
      ...prev,
      androidStores: [],
      useCarriers: false,
      carriers: [],
      usePays: false,
      pays: [],
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

  const toggleArrayItem = (key: 'androidStores' | 'carriers' | 'pays' | 'voucherBypasses', item: string) => {
    setFilter((prev) => {
      const list = prev[key];
      const nextList = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
      return { ...prev, [key]: nextList };
    });
  };

  return {
    filter,
    setFilter,
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