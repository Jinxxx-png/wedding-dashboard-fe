import { PageHeader } from '@/components/shared/PageHeader';
import { useSelectedWebsite } from '@/contexts/WebsiteContext';
import { GuestManager } from '@/features/guests/GuestManager';

export function GuestsPage() {
  const website = useSelectedWebsite();
  return (
    <>
      <PageHeader title="Guest Management" description="Every individual guest across your RSVP submissions." />
      <GuestManager website={website} />
    </>
  );
}
