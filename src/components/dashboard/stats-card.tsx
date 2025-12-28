import { LucideIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface StatsCardProps {
    title: string;
    value: string;
    change?: string;
    changeType?: "positive" | "negative" | "warning";
    icon: LucideIcon;
    subtext?: string;
    trend?: string;
}

export function StatsCard({ title, value, change, changeType = "positive", icon: Icon, subtext, trend }: StatsCardProps) {
    return (
        <div className="card flex flex-col justify-between h-[160px]">
            <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-100 dark:bg-[#2C2C2C] rounded-md">
                    <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </div>

                {trend && (
                    <span className={cn("text-xs font-medium",
                        trend === "up" ? "text-[var(--success)]" : "text-[var(--danger)]"
                    )}>
                        {trend === "up" ? "↗" : "↘"}
                    </span>
                )}
            </div>

            <div>
                <h3 className="text-2xl font-bold">{value}</h3>
                <p className="text-sm text-muted-foreground">{title}</p>

                <div className="mt-2 flex items-center gap-2">
                    {change && (
                        <span className={cn("text-xs font-medium",
                            changeType === "positive" ? "text-[var(--success)]" :
                                changeType === "negative" ? "text-[var(--danger)]" : "text-[var(--warning)]"
                        )}>
                            {change}
                        </span>
                    )}
                    {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
                </div>
            </div>
        </div>
    );
}
