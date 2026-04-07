import type { Plant, CareTask, CareIntervals } from "@/lib/plantCare";
import { getLightIcon, getLightLabel, generateCareTasks, getCareIcon, getCareLabel } from "@/lib/plantCare";
import { Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { PlantDiagnosis } from "./PlantDiagnosis";

interface PlantCardProps {
  plant: Plant;
  onDelete: (id: string) => void;
  onEdit: (plant: Plant) => void;
  onViewDetails: (plant: Plant) => void;
  onRegisterCare?: (plant: Plant, type: "water" | "fertilize" | "spray") => void;
}

function getTaskLabel(task: CareTask, today: string): string {
  if (task.date === today) return `${getCareLabel(task.type)} hoje`;
  const diff = Math.round(
    (new Date(task.date).getTime() - new Date(today).getTime()) / 86_400_000
  );
  if (diff === 1) return `${getCareLabel(task.type)} amanhã`;
  return `${getCareLabel(task.type)} em ${diff}d`;
}

export function PlantCard({ plant, onDelete, onEdit, onViewDetails, onRegisterCare }: PlantCardProps) {
  const today = new Date().toISOString().split("T")[0];
  const allTasks = generateCareTasks(plant, 30);
  const todayTasks = allTasks.filter((t) => t.date === today);

  // When nothing is due today, show the next upcoming task per care type
  const displayTasks: CareTask[] =
    todayTasks.length > 0
      ? todayTasks
      : (["water", "fertilize", "spray"] as const).flatMap((type) => {
          const next = allTasks.find((t) => t.type === type && t.date > today);
          return next ? [next] : [];
        });

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <button
          className="flex items-center gap-3 flex-1 text-left"
          onClick={() => onViewDetails(plant)}
          aria-label={`Ver detalhes de ${plant.name}`}
        >
          {plant.photo ? (
            <img
              src={plant.photo}
              alt={plant.name}
              className="w-12 h-12 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl shrink-0">
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
            {plant.scientificName && (
              <p className="text-xs text-muted-foreground italic">{plant.scientificName}</p>
            )}
          </div>
        </button>
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

      {displayTasks.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {displayTasks.map((task, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-accent-foreground text-xs font-medium"
            >
              {getCareIcon(task.type)} {getTaskLabel(task, today)}{task.amount != null ? ` • ${task.amount}ml` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Quick care registration buttons */}
      {onRegisterCare && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground mb-2">Registrar cuidado realizado:</p>
          <div className="flex gap-2">
            {(["water", "fertilize", "spray"] as const).map((type) => (
              <button
                key={type}
                onClick={() => onRegisterCare(plant, type)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border border-border bg-accent/40 hover:bg-primary/10 hover:border-primary/40 text-xs font-medium text-foreground transition-colors"
                aria-label={`Registrar ${getCareLabel(type)}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                {getCareIcon(type)} {getCareLabel(type)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Disease diagnosis */}
      <div className="mt-3 pt-3 border-t border-border">
        <PlantDiagnosis plantName={plant.name} />
      </div>
    </div>
  );
}
