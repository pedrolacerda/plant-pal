import type { Plant } from "@/lib/plantCare";
import { getLightIcon, getLightLabel, generateCareTasks, getCareIcon, getCareLabel } from "@/lib/plantCare";
import { Trash2, Pencil } from "lucide-react";
import { PlantDiagnosis } from "./PlantDiagnosis";

interface PlantCardProps {
  plant: Plant;
  onDelete: (id: string) => void;
  onEdit: (plant: Plant) => void;
}

export function PlantCard({ plant, onDelete, onEdit }: PlantCardProps) {
  const today = new Date().toISOString().split("T")[0];
  const todayTasks = generateCareTasks(plant, 1).filter((t) => t.date === today);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {plant.photo ? (
            <img
              src={plant.photo}
              alt={plant.name}
              className="w-12 h-12 rounded-xl object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl">
              🪴
            </div>
          )}
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground leading-tight">
              {plant.name}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {getLightIcon(plant.light)} {getLightLabel(plant.light)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(plant)}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Editar planta"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(plant.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remover planta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {plant.tip && (
        <p className="mt-2 text-xs text-muted-foreground italic px-1">
          💡 {plant.tip}
        </p>
      )}

      {todayTasks.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {todayTasks.map((task, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-accent-foreground text-xs font-medium"
            >
              {getCareIcon(task.type)} {getCareLabel(task.type)} hoje
            </span>
          ))}
        </div>
      )}

      {/* Disease diagnosis */}
      <div className="mt-3 pt-3 border-t border-border">
        <PlantDiagnosis plantName={plant.name} />
      </div>
    </div>
  );
}
