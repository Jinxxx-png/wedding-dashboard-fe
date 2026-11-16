import { PageHeader } from '@/components/shared/PageHeader';
import { useSelectedWebsite } from '@/contexts/WebsiteContext';
import { WishesManager } from '@/features/wishes/WishesManager';

export function WishesPage() {
  const website = useSelectedWebsite();
  return (
    <>
      <PageHeader title="Wedding Wishes" description="Messages your guests left on your wedding website." />
      <WishesManager website={website} />
    </>
  );
}
