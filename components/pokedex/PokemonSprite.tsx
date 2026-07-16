"use client";

import Image from "next/image";
import { useState } from "react";

type PokemonSpriteProps = {
  dexNo: number;
  alt: string;
  silhouette?: boolean; // 미포획: 스프라이트를 명도 0%로 깎아 실루엣만 노출(PRD §8.5)
  fallbackClass?: string; // 파일 누락/로드 실패 시 기존 컬러 원으로 폴백
};

export function PokemonSprite({ dexNo, alt, silhouette = false, fallbackClass }: PokemonSpriteProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`h-2/3 w-2/3 rounded-full ${silhouette ? "bg-black" : (fallbackClass ?? "bg-zinc-400")}`} />;
  }

  return (
    <Image
      src={`/sprites/pokemon/${dexNo}.png`}
      alt={alt}
      fill
      sizes="160px"
      unoptimized // 96px 픽셀 아트 — 리샘플링하면 도트가 뭉개져서 원본 그대로 서빙
      onError={() => setFailed(true)}
      className={`object-contain p-1 ${silhouette ? "brightness-0" : ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
