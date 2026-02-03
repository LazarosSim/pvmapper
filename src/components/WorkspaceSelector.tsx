/**
 * Workspace Selector Component
 * Allows users to select a park as their workspace and prefetch all data for offline use
 */

import { useState } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useParkStats } from '@/hooks/use-park-queries';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const WorkspaceSelector = () => {
    const { data: parks, isLoading: isLoadingParks } = useParkStats(false); // Only active parks
    const {
        currentWorkspace,
        workspaceStatus,
        selectWorkspace,
        prefetchWorkspace,
        isWorkspaceReady,
    } = useWorkspace();

    const [selectedParkId, setSelectedParkId] = useState<string>(currentWorkspace || '');

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

        // Park = 10%, Rows = 20%, Barcodes = 70%
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
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Offline Workspace
                </CardTitle>
                <CardDescription>
                    Select a park to prepare for offline work. All rows and barcodes will be downloaded.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Park Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Park</label>
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
                            size="lg"
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
                        <AlertDescription className="text-green-800">
                            <strong>{selectedPark.name}</strong> is ready for offline work. You can now go offline
                            and scan barcodes across all rows in this park.
                        </AlertDescription>
                    </Alert>
                )}

                {workspaceStatus.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{workspaceStatus.error}</AlertDescription>
                    </Alert>
                )}

                {/* Info */}
                {!selectedParkId && !isLoadingParks && (
                    <Alert>
                        <AlertDescription className="text-sm">
                            ℹ️ Select a park and click "Prepare for Offline" to download all data for field work.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};
