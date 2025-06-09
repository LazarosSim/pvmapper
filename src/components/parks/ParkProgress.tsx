import {Progress} from "@/components/ui/progress.tsx";
import React from "react";


interface ParkProgressProps {
    name: string
    percentage: string
    current: number
    expected: number
}

export const ParkProgress: React.FC<ParkProgressProps> = ({
    name,
    percentage,
    current,
    expected
}) => {
    return (
        <div className="space-y-2">
            <div className="flex justify-between">
                <span>{name}</span>
                <span className={`h-2 ${percentage > 100 ? 'text-red-700 ' : ''}`}>{percentage}%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{current} scanned</span>
                <span>{expected} expected</span>
            </div>
            <Progress
                value={Number(percentage)}
                className={`h-2 ${percentage === 100 ? 'bg-green-200' : ''}`}
            />
        </div>
    )
}