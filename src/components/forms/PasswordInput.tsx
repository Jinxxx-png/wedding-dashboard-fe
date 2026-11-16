import { forwardRef, useState, type ComponentProps } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { checkPassword } from '@/utils/password';

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

/** Live checklist of the password policy (the server stays authoritative). */
export function PasswordChecklist({ password, username }: { password: string; username?: string }) {
  const checks = checkPassword(password, username);
  return (
    <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {checks.map((c) => (
        <li key={c.id} className={cn('flex items-center gap-1.5', c.ok ? 'text-emerald-700' : 'text-muted-foreground')}>
          {c.ok ? <Check className="size-3.5" /> : <X className="size-3.5 opacity-60" />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
