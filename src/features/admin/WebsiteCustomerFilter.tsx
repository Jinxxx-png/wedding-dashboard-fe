import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomerDirectory, useWebsiteDirectory } from './useDirectories';

export const ALL = '__all__';

interface WebsiteCustomerFilterProps {
  websiteId: string;
  customerId: string;
  onChange: (next: { websiteId: string; customerId: string }) => void;
}

/**
 * Website + customer filters for the global lists. The API filters by `websiteId` only, so
 * choosing a customer narrows the website list to theirs and selects their first website.
 */
export function WebsiteCustomerFilter({ websiteId, customerId, onChange }: WebsiteCustomerFilterProps) {
  const websites = useWebsiteDirectory();
  const customers = useCustomerDirectory();

  const options = useMemo(
    () => (customerId === ALL ? websites.websites : websites.websites.filter((w) => w.ownerUserId === customerId)),
    [websites.websites, customerId],
  );

  return (
    <>
      <Select
        value={customerId}
        onValueChange={(c) => {
          if (c === ALL) onChange({ customerId: ALL, websiteId: ALL });
          else {
            const first = websites.websites.find((w) => w.ownerUserId === c);
            onChange({ customerId: c, websiteId: first?.id ?? ALL });
          }
        }}
      >
        <SelectTrigger className="sm:w-[180px]" aria-label="Customer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All customers</SelectItem>
          {customers.customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              @{c.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={websiteId} onValueChange={(w) => onChange({ customerId, websiteId: w })}>
        <SelectTrigger className="sm:w-[220px]" aria-label="Website">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {customerId === ALL && <SelectItem value={ALL}>All websites</SelectItem>}
          {options.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.websiteName} · /{w.slug}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
