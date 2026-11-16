import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { notifyError } from '@/utils/errors';

export function LogoutAllCard() {
  const { logoutAll } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Sign out everywhere, including this browser, if you think your account was used elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <LogOut /> Log out of all devices
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Log out of all devices?"
        description="Every active session, including this one, will be ended. You'll need to sign in again."
        confirmLabel="Log out everywhere"
        destructive
        onConfirm={async () => {
          try {
            await logoutAll();
            toast.success('Signed out of all devices');
            navigate('/login', { replace: true });
          } catch (error) {
            notifyError(error, 'Could not log out of all devices');
            navigate('/login', { replace: true });
          }
        }}
      />
    </Card>
  );
}
