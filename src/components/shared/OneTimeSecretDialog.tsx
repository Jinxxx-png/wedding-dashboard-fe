import { useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { CopyButton } from './CopyButton';
import { formatDateTime } from '@/utils/format';

export interface OneTimeSecret {
  title: string;
  description?: string;
  /** Non-secret context rows, e.g. username or key id. */
  details?: { label: string; value: string }[];
  secretLabel: string;
  secret: string;
  expiresAt?: string;
  note?: string;
}

interface OneTimeSecretDialogProps {
  /** The secret lives only in the parent's component state; pass null to close and discard it. */
  secret: OneTimeSecret | null;
  onClose: () => void;
}

/**
 * Shows a one-time secret (temporary password / signing secret) exactly once.
 * Never persisted to storage, never put in URLs or logs. Closing the dialog discards it.
 */
export function OneTimeSecretDialog({ secret, onClose }: OneTimeSecretDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const close = () => {
    setAcknowledged(false);
    onClose();
  };

  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && acknowledged && close()}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
        onEscapeKeyDown={(e) => !acknowledged && e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {secret && (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl border bg-muted/50">
                <KeyRound className="size-5" />
              </div>
              <DialogTitle>{secret.title}</DialogTitle>
              {secret.description && <DialogDescription>{secret.description}</DialogDescription>}
            </DialogHeader>

            {secret.details && secret.details.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                {secret.details.map((d) => (
                  <div key={d.label} className="contents">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd className="truncate font-medium">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{secret.secretLabel}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code
                  className="flex-1 rounded-lg border bg-zinc-950 px-3 py-2.5 font-mono text-sm break-all text-zinc-50 select-all"
                  data-testid="one-time-secret"
                >
                  {secret.secret}
                </code>
                <CopyButton value={secret.secret} />
              </div>
              {secret.expiresAt && (
                <p className="text-xs text-muted-foreground">Expires {formatDateTime(secret.expiresAt)}</p>
              )}
            </div>

            <Alert variant="warning">
              <ShieldAlert />
              <AlertTitle>This will only be shown once</AlertTitle>
              <AlertDescription>
                <p>
                  {secret.note ??
                    'Copy it now and deliver it securely (in person or via an encrypted channel). It cannot be displayed again after you close this dialog.'}
                </p>
              </AlertDescription>
            </Alert>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} />
              I have copied it and will deliver it securely
            </label>

            <DialogFooter>
              <Button onClick={close} disabled={!acknowledged}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
