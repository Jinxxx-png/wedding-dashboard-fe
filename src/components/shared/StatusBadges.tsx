import { CheckCircle2, CircleDashed, Clock, Eye, EyeOff, Lock, Star, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccountStatus, AttendanceStatus, GuestType } from '@/types/api';

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return status === 'attending' ? (
    <Badge variant="success">
      <CheckCircle2 /> Attending
    </Badge>
  ) : (
    <Badge variant="muted">
      <XCircle /> Not attending
    </Badge>
  );
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  if (status === 'active') {
    return (
      <Badge variant="success">
        <CheckCircle2 /> Active
      </Badge>
    );
  }
  if (status === 'disabled') {
    return (
      <Badge variant="destructive">
        <XCircle /> Disabled
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <Clock /> Pending setup
    </Badge>
  );
}

export function LockedBadge() {
  return (
    <Badge variant="warning">
      <Lock /> Locked
    </Badge>
  );
}

export function ActiveBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return active ? (
    <Badge variant="success">
      <CheckCircle2 /> {activeLabel}
    </Badge>
  ) : (
    <Badge variant="muted">
      <CircleDashed /> {inactiveLabel}
    </Badge>
  );
}

const GUEST_TYPE_LABEL: Record<GuestType, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' };

export function GuestTypeBadge({ type }: { type?: GuestType | null }) {
  if (!type) return <Badge variant="outline">Unspecified</Badge>;
  return <Badge variant={type === 'adult' ? 'secondary' : 'info'}>{GUEST_TYPE_LABEL[type]}</Badge>;
}

export function VisibilityBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <Badge variant="outline">
      <Eye /> Visible
    </Badge>
  ) : (
    <Badge variant="warning">
      <EyeOff /> Hidden
    </Badge>
  );
}

export function FavouriteBadge() {
  return (
    <Badge variant="outline" className="border-amber-200 text-amber-700">
      <Star className="fill-amber-400 text-amber-500" /> Favourite
    </Badge>
  );
}
