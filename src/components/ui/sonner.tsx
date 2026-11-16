import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'rounded-lg! border-border! shadow-lg! font-sans!',
          description: 'text-muted-foreground!',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
