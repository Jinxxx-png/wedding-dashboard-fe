import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts.
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  el.remove();
}

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await writeClipboard(value);
          setCopied(true);
        } catch {
          toast.error('Could not copy to clipboard. Select the text and copy it manually.');
        }
      }}
    >
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
