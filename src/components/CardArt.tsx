import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const GRADIENTS: Record<string, string> = {
  platinum: 'linear-gradient(135deg, #9a9da2 0%, #e2e5ea 50%, #a7abb2 100%)',
  gold: 'linear-gradient(135deg, #b8862f 0%, #f4d488 50%, #caa04a 100%)',
  green: 'linear-gradient(135deg, #12472f 0%, #3fa578 100%)',
  'sapphire-reserve': 'linear-gradient(135deg, #0a1a30 0%, #1b3a6b 100%)',
  'sapphire-preferred': 'linear-gradient(135deg, #102a52 0%, #2456a6 100%)',
  'venture-x': 'linear-gradient(135deg, #16181c 0%, #3a4048 100%)',
  'marriott-brilliant': 'linear-gradient(135deg, #3a1c14 0%, #8a4326 100%)',
  'hilton-aspire': 'linear-gradient(135deg, #08283f 0%, #12557f 100%)',
  'delta-reserve': 'linear-gradient(135deg, #0f1a2c 0%, #7a1f2b 100%)',
  'strata-premier': 'linear-gradient(135deg, #0d2030 0%, #2b6b6b 100%)',
  'strata-elite': 'linear-gradient(135deg, #0b1417 0%, #123138 100%)',
  'premium-rewards-elite': 'linear-gradient(135deg, #0a2a4a 0%, #9e1b2f 100%)',
  'ritz-carlton': 'linear-gradient(135deg, #0d0d0d 0%, #3c3427 100%)',
  'hilton-surpass': 'linear-gradient(135deg, #0a3c5f 0%, #2091c2 100%)',
  'world-of-hyatt': 'linear-gradient(135deg, #14284b 0%, #2f5090 100%)',
  'delta-platinum': 'linear-gradient(135deg, #8a9099 0%, #d6dadf 50%, #969ca4 100%)',
  'autograph-journey': 'linear-gradient(135deg, #171717 0%, #6b1f2a 100%)',
};

const FALLBACKS = [
  'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
  'linear-gradient(135deg, #414345 0%, #232526 100%)',
  'linear-gradient(135deg, #355c7d 0%, #6c5b7b 100%)',
];

const DARK_TEXT_ART = new Set(['platinum', 'gold', 'delta-platinum']);

function gradientFor(artRef?: string): string {
  if (artRef && GRADIENTS[artRef]) return GRADIENTS[artRef];
  const key = artRef ?? '';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACKS[hash % FALLBACKS.length];
}

export interface CardArtProps {
  name: string;
  issuer?: string;
  network?: string;
  last4?: string;
  artRef?: string;
  imageUrl?: string;
  nickname?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function CardArt({
  name,
  issuer,
  network,
  last4,
  artRef,
  imageUrl,
  nickname,
  size = 'md',
  className,
}: CardArtProps) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);
  const showImage = Boolean(imageUrl) && !imgFailed;
  const darkText = artRef ? DARK_TEXT_ART.has(artRef) : false;
  return (
    <div
      className={cn(
        'card-art',
        `card-art--${size}`,
        darkText && 'card-art--dark-text',
        showImage && 'card-art--has-image',
        className,
      )}
      style={{ backgroundImage: gradientFor(artRef) }}
    >
      {showImage && (
        <img
          className="card-art__img"
          src={imageUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="card-art__sheen" aria-hidden />
      <div className="card-art__top">
        {network && <span className="card-art__network">{network.toUpperCase()}</span>}
        {issuer && <span className="card-art__issuer">{issuer}</span>}
      </div>
      <div className="card-art__name">{nickname || name}</div>
      <div className="card-art__foot">
        <span className="card-art__chip" aria-hidden />
        <span className="card-art__digits">{last4 ? `•••• ${last4}` : ''}</span>
      </div>
    </div>
  );
}
