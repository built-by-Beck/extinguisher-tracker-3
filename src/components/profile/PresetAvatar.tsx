import {
  Building2,
  ClipboardCheck,
  Flame,
  HardHat,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { PresetAvatarId } from '../../types/index.ts';

export const PRESET_AVATARS: Array<{
  id: PresetAvatarId;
  label: string;
  className: string;
  icon: typeof HardHat;
}> = [
  { id: 'helmet-red', label: 'Red helmet', className: 'bg-red-100 text-red-700', icon: HardHat },
  { id: 'shield-blue', label: 'Blue shield', className: 'bg-blue-100 text-blue-700', icon: ShieldCheck },
  { id: 'clipboard-green', label: 'Green checklist', className: 'bg-emerald-100 text-emerald-700', icon: ClipboardCheck },
  { id: 'building-slate', label: 'Slate building', className: 'bg-slate-100 text-slate-700', icon: Building2 },
  { id: 'spark-amber', label: 'Amber spark', className: 'bg-amber-100 text-amber-700', icon: Sparkles },
  { id: 'hydrant-purple', label: 'Purple hydrant', className: 'bg-purple-100 text-purple-700', icon: Flame },
];

interface PresetAvatarProps {
  avatarId?: PresetAvatarId | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

const iconClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function getPresetAvatar(avatarId?: PresetAvatarId | null) {
  return PRESET_AVATARS.find((avatar) => avatar.id === avatarId) ?? PRESET_AVATARS[0];
}

export function PresetAvatar({ avatarId, size = 'md' }: PresetAvatarProps) {
  const avatar = getPresetAvatar(avatarId);
  const Icon = avatar.icon;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${sizeClasses[size]} ${avatar.className}`}
      title={avatar.label}
    >
      <Icon className={iconClasses[size]} />
    </span>
  );
}
