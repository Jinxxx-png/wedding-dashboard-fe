import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
  'aria-label'?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', hint, className, ...rest }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        aria-label={rest['aria-label'] ?? placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
      {hint && <p className="absolute top-full left-0 mt-1 text-xs text-amber-700">{hint}</p>}
    </div>
  );
}
