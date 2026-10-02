/**
 * Settings Dialog Component
 * Global settings accessible from the header gear icon
 */

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useCurrentUser } from '@/hooks/use-user';
import { useActiveParkCount, useSyncSummary } from '@/lib/local/hooks';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Load the latest published app from the server. Only the saved copy of the app is
 *  dropped: scans, parks and the login stay on the phone. */
const reloadApp = async () => {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    window.location.reload();
};

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
    const { data: currentUser } = useCurrentUser();
    const { showArchived, setShowArchived } = useAppSettings();
    const activeParkCount = useActiveParkCount() ?? 0;
    const { lastSyncedAt, online } = useSyncSummary();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure app settings and preferences
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Show Archived Section (Managers only) */}
                    {currentUser?.role === 'manager' && (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="show-archived" className="text-base font-semibold">
                                        Show Archived Parks
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Show parks that have been moved to archive
                                    </p>
                                </div>
                                <Switch
                                    id="show-archived"
                                    checked={showArchived}
                                    onCheckedChange={setShowArchived}
                                />
                            </div>
                            <Separator />
                        </>
                    )}

                    {/* Offline: automatic, nothing to prepare */}
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">Offline work</Label>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                            <p>
                                All {activeParkCount} active park{activeParkCount === 1 ? ' is' : 's are'} kept
                                on this phone and updated automatically whenever there is a connection
                                {lastSyncedAt ? ` (last ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })})` : ''}.
                                Scans made offline are uploaded when the connection returns.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">App version {__APP_VERSION__} UTC</p>
                        {/* Needs a connection: the app is downloaded again */}
                        <Button variant="outline" size="sm" disabled={!online} onClick={() => void reloadApp()}>
                            Reload app
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
