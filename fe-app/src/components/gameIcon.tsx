import React, { useState } from 'react';
import { GAME_ASSETS } from '../constants/gameAssets';

interface GameIconProps {
  title: string;
  sizeClass?: string; // 예: "w-10 h-10" 또는 "w-12 h-12"
}

export default function GameIcon({ title, sizeClass = 'w-10 h-10' }: GameIconProps) {
  const [imgError, setImgError] = useState(false);
  const game = GAME_ASSETS[title];

  // 이미지가 등록되어 있고 로드 에러가 없을 때 <img> 렌더링
  if (game?.imageUrl && !imgError) {
    return (
      <img
        src={game.imageUrl}
        alt={title}
        className={`${sizeClass} object-cover rounded-xl shadow-xs shrink-0 border border-slate-200`}
        onError={() => setImgError(true)} // 이미지 파일이 실제로 없으면 이모티콘으로 복구
      />
    );
  }

  // 이미지 등록이 안 되었거나 로드 실패 시 이모티콘 출력
  return (
    <span className="text-4xl shrink-0 leading-none">
      {game?.emojiFallback || '🎮'}
    </span>
  );
}