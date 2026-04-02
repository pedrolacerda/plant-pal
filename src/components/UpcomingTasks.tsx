import type { Plant } from "@/lib/plantCare";
import { getUpcomingTasks, getCareIcon, getCareLabel } from "@/lib/plantCare";
import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const todayStr = new Date().toISOString().split("T")[0];

interface UpcomingTasksProps {
  plants: Plant[];
}

export function UpcomingTasks({ plants }: UpcomingTasksProps) {
  const tasks = useMemo(() => getUpcomingTasks(plants, 7), [plants]);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Adicione plantas para ver os próximos cuidados 🌱
      </p>
    );
  }

  // Group by date
  const grouped = tasks.reduce((acc, task) => {
    if (!acc[task.date]) acc[task.date] = [];
    acc[task.date].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, dateTasks]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {date === todayStr
              ? "Hoje"
              : format(new Date(date + "T12:00:00"), "EEEE, d MMM", { locale: ptBR })}
          </p>
          <div className="space-y-1.5">
            {dateTasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border"
              >
                <span className="text-lg">{getCareIcon(task.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {task.plantName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getCareLabel(task.type)}
                    {task.amount != null ? ` • ${task.amount} ml` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
