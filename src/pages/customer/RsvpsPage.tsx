import { PageHeader } from '@/components/shared/PageHeader';
import { useSelectedWebsite } from '@/contexts/WebsiteContext';
import { RsvpManager } from '@/features/rsvps/RsvpManager';

export function RsvpsPage() {
  const website = useSelectedWebsite();
  return (
    <>
      <PageHeader
        title="RSVP Management"
        description={`Review, search and export RSVP submissions for ${website.websiteName}.`}
      />
      <RsvpManager website={website} />
    </>
  );
}
