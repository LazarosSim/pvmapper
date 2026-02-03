/**
 * Settings Dialog Component
 * Global settings accessible from the header gear icon
 */

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useParkStats } from '@/hooks/use-park-queries';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useCurrentUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
    const { data: parks, isLoading: isLoadingParks } = useParkStats(false);
    const {
        currentWorkspace,
        workspaceStatus,
        selectWorkspace,
        prefetchWorkspace,
        clearWorkspace,
        isWorkspaceReady,
    } = useWorkspace();

    const { data: currentUser } = useCurrentUser();
    const { showArchived, setShowArchived } = useAppSettings();

    const [offlineModeEnabled, setOfflineModeEnabled] = useState<boolean>(!!currentWorkspace);
    const [selectedParkId, setSelectedParkId] = useState<string>(currentWorkspace || '');

    const handleOfflineModeToggle = (checked: boolean) => {
        setOfflineModeEnabled(checked);
        if (!checked) {
            // Clear workspace when disabling offline mode
            clearWorkspace();
            setSelectedParkId('');
        }
    };

    const handleSelectPark = (parkId: string) => {
        setSelectedParkId(parkId);
        selectWorkspace(parkId);
    };

    const handlePrefetch = async () => {
        if (!selectedParkId) return;
        await prefetchWorkspace();
    };

    const getProgressPercentage = () => {
        if (workspaceStatus.isPrefetched) return 100;
        if (!workspaceStatus.isPrefetching) return 0;

        const { current, total } = workspaceStatus.progress;
        if (total === 0) return 0;

        switch (workspaceStatus.progress.stage) {
            case 'park':
                return 10;
            case 'rows':
                return 20;
            case 'barcodes':
                return 20 + (current / total) * 70;
            case 'complete':
                return 100;
            default:
                return 0;
        }
    };

    const getProgressLabel = () => {
        if (workspaceStatus.isPrefetched) return 'Workspace ready for offline work';
        if (!workspaceStatus.isPrefetching) return '';

        switch (workspaceStatus.progress.stage) {
            case 'park':
                return 'Loading park data...';
            case 'rows':
                return 'Loading rows...';
            case 'barcodes':
                return `Downloading barcodes (${workspaceStatus.progress.current}/${workspaceStatus.progress.total} rows)`;
            case 'complete':
                return 'Complete!';
            default:
                return '';
        }
    };

    const selectedPark = parks?.find(p => p.id === selectedParkId);

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

                    {/* Offline Mode Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="offline-mode" className="text-base font-semibold">
                                    Offline Mode
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Prepare a park for offline field work
                                </p>
                            </div>
                            <Switch
                                id="offline-mode"
                                checked={offlineModeEnabled}
                                onCheckedChange={handleOfflineModeToggle}
                            />
                        </div>

                        {/* Workspace Configuration - Shows when offline mode is enabled */}
                        {offlineModeEnabled && (
                            <div className="space-y-4 pl-0 border-l-2 border-primary/20 rounded">
                                <div className="pl-4 space-y-3">
                                    {/* Park Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Select Park</Label>
                                        <Select
                                            value={selectedParkId}
                                            onValueChange={handleSelectPark}
                                            disabled={workspaceStatus.isPrefetching || isLoadingParks}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose a park..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {parks?.map((park) => (
                                                    <SelectItem key={park.id} value={park.id}>
                                                        {park.name} ({park.currentBarcodes}/{park.expectedBarcodes})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Action Button */}
                                    {selectedParkId && (
                                        <div className="space-y-2">
                                            <Button
                                                onClick={handlePrefetch}
                                                disabled={workspaceStatus.isPrefetching || isWorkspaceReady}
                                                className="w-full"
                                                size="default"
                                            >
                                                {workspaceStatus.isPrefetching && (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                )}
                                                {isWorkspaceReady && (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                {!workspaceStatus.isPrefetching && !isWorkspaceReady && (
                                                    <Download className="mr-2 h-4 w-4" />
                                                )}
                                                {isWorkspaceReady
                                                    ? 'Workspace Ready'
                                                    : workspaceStatus.isPrefetching
                                                        ? 'Preparing...'
                                                        : 'Prepare for Offline'}
                                            </Button>

                                            {/* Progress Bar */}
                                            {(workspaceStatus.isPrefetching || isWorkspaceReady) && (
                                                <div className="space-y-1">
                                                    <Progress value={getProgressPercentage()} className="h-2" />
                                                    <p className="text-xs text-muted-foreground text-center">
                                                        {getProgressLabel()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Status Alerts */}
                                    {isWorkspaceReady && selectedPark && (
                                        <Alert className="bg-green-50 border-green-200">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-green-800 text-sm">
                                                <strong>{selectedPark.name}</strong> is ready for offline work.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {workspaceStatus.error && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="text-sm">{workspaceStatus.error}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Future Settings Placeholder */}
                    <div className="text-center py-2">
                        <p className="text-sm text-muted-foreground">
                            More settings coming soon...
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
