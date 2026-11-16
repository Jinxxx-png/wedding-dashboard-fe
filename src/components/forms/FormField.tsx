import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: ReactNode;
  error?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  /** A single input-like element; receives id / aria-invalid / aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
  labelAction?: ReactNode;
}

export function FormField({ label, error, description, required, className, children, labelAction }: FormFieldProps) {
  const autoId = useId();
  const childId = (isValidElement(children) && (children.props.id as string | undefined)) || autoId;
  const descId = `${childId}-desc`;
  const errId = `${childId}-error`;
  const describedBy = [description ? descId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={childId}>
          {label}
          {required && <span className="text-destructive" aria-hidden="true">*</span>}
        </Label>
        {labelAction}
      </div>
      {cloneElement(children, {
        id: childId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {description && !error && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs whitespace-pre-line text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
