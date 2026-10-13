import { User } from "lucide-react";
import BoringAvatar from "boring-avatars";
import Avvvatars from "avvvatars-react";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import { getDiceBearUri } from "./AvatarUpload";

interface ResolvedAvatarProps {
  url: string | null | undefined;
  fallbackSeed?: string;
  size?: number;
  className?: string;
}

const BORING_COLORS = ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"];

/**
 * Universal avatar renderer that supports all avatar URL prefixes:
 * - dicebear:style:seed
 * - boring:variant:seed
 * - avvvatars:style:seed
 * - niceavatar:seed
 * - Regular URLs (uploaded images)
 * - null/undefined (fallback)
 */
const ResolvedAvatar = ({ url, fallbackSeed, size = 80, className = "" }: ResolvedAvatarProps) => {
  if (!url && fallbackSeed) {
    return (
      <div className={`rounded-2xl overflow-hidden shrink-0 ${className}`} style={{ width: size, height: size }}>
        <BoringAvatar size={size} name={fallbackSeed} variant="beam" colors={BORING_COLORS} />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={`rounded-2xl bg-gradient-eternia flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <User className="text-background" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  // DiceBear
  if (url.startsWith("dicebear:")) {
    const [, style, seed] = url.split(":");
    const src = getDiceBearUri(style, seed);
    return (
      <div className={`rounded-2xl overflow-hidden shrink-0 ${className}`} style={{ width: size, height: size }}>
        <img src={src} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  // Boring Avatars
  if (url.startsWith("boring:")) {
    const [, variant, seed] = url.split(":");
    return (
      <div className={`rounded-2xl overflow-hidden shrink-0 ${className}`} style={{ width: size, height: size }}>
        <BoringAvatar
          size={size}
          name={seed}
          variant={variant as any}
          colors={BORING_COLORS}
        />
      </div>
    );
  }

  // Avvvatars
  if (url.startsWith("avvvatars:")) {
    const [, style, seed] = url.split(":");
    return (
      <div className={`rounded-2xl overflow-hidden shrink-0 flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <Avvvatars value={seed} style={style as "character" | "shape"} size={size} />
      </div>
    );
  }

  // Nice Avatar
  if (url.startsWith("niceavatar:")) {
    const seed = url.replace("niceavatar:", "");
    const config = genConfig(seed);
    return (
      <div className={`rounded-2xl overflow-hidden shrink-0 ${className}`} style={{ width: size, height: size }}>
        <NiceAvatar style={{ width: size, height: size }} {...config} />
      </div>
    );
  }

  // Legacy emoji prefix
  if (url.startsWith("emoji:")) {
    return (
      <div
        className={`rounded-2xl bg-gradient-eternia flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <User className="text-background" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  // Regular URL (uploaded image)
  return (
    <div className={`rounded-2xl overflow-hidden shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img src={url} alt="Avatar" className="w-full h-full object-cover" />
    </div>
  );
};

export default ResolvedAvatar;
