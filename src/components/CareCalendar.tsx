import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import type { Plant, CareTask } from "@/lib/plantCare";
import { generateCareTasks, getCareIcon, getCareLabel } from "@/lib/plantCare";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CareCalendarProps {
  plants: Plant[];
}

export function CareCalendar({ plants }: CareCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const allTasks = useMemo(() => {
    return plants.flatMap((p) => generateCareTasks(p, 90));
  }, [plants]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CareTask[]>();
    for (const task of allTasks) {
      const existing = map.get(task.date) || [];
      existing.push(task);
      map.set(task.date, existing);
    }
    return map;
  }, [allTasks]);

  const selectedDateStr = selectedDate
    ? selectedDate.toISOString().split("T")[0]
    : "";
  const selectedTasks = tasksByDate.get(selectedDateStr) || [];

  const datesWithTasks = useMemo(() => {
    return Array.from(tasksByDate.keys()).map((d) => new Date(d + "T12:00:00"));
  }, [tasksByDate]);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={ptBR}
          className={cn("p-0 pointer-events-auto w-full")}
          classNames={{
            months: "flex flex-col w-full",
            month: "space-y-4 w-full",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 flex-1 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-full p-0 font-normal aria-selected:opacity-100"),
          }}
          modifiers={{ hasTasks: datesWithTasks }}
          modifiersClassNames={{
            hasTasks: "bg-accent text-accent-foreground font-bold",
          }}
        />
      </div>

      {selectedDate && (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </h3>

          {selectedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum cuidado agendado para este dia 🌿
            </p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border"
                >
                  <span className="text-xl">{getCareIcon(task.type)}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {getCareLabel(task.type)}
                      {task.amount != null ? ` • ${task.amount} ml` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{task.plantName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
