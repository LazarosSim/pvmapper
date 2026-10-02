import {Progress} from "@/components/ui/progress.tsx";
import React from "react";

interface ParkProgressProps {
    name: string
    // current / expected * 100; null when nothing is expected (no meaningful percentage)
    percentage: number | null
    current: number
    expected: number
}

export const ParkProgress: React.FC<ParkProgressProps> = ({
    name,
    percentage,
    current,
    expected
}) => {
    // The bar can't go past full; the text still shows the real number (e.g. 120%)
    const barValue = percentage === null ? 0 : Math.min(100, Math.max(0, percentage));
    return (
        <div className="space-y-2">
            <div className="flex justify-between">
                <span>{name}</span>
                <span className={`h-2 ${percentage !== null && percentage > 100 ? 'text-red-700 ' : ''}`}>
                    {percentage === null ? '—' : `${percentage.toFixed(2)}%`}
                </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{current} scanned</span>
                <span>{expected} expected</span>
            </div>
            <Progress
                value={barValue}
                className={`h-2 ${percentage === 100 ? 'bg-green-200' : ''}`}
            />
        </div>
    )
}
