import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
};

export default function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow p-5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary-light bg-opacity-20 flex items-center justify-center">
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className={cn(
          "text-sm font-medium mt-2 flex items-center",
          trend.isPositive ? "text-green-500" : "text-yellow-500"
        )}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={trend.isPositive 
                ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              } 
            />
          </svg>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
