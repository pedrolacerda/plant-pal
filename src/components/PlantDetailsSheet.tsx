import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Plant } from "@/lib/plantCare";
import { getLightIcon, getLightLabel, getCareIcon, getCareLabel } from "@/lib/plantCare";

interface PlantDetailsSheetProps {
  plant: Plant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlantDetailsSheet({ plant, open, onOpenChange }: PlantDetailsSheetProps) {
  if (!plant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto max-w-lg mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">{plant.name}</SheetTitle>
          {plant.scientificName && (
            <SheetDescription className="italic text-sm">{plant.scientificName}</SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-5 mt-5 pb-6">
          {/* Photo */}
          {plant.photo && (
            <img
              src={plant.photo}
              alt={plant.name}
              className="w-full h-48 object-cover rounded-2xl border border-border"
            />
          )}

          {/* Description */}
          {plant.description && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Sobre a planta</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{plant.description}</p>
            </div>
          )}

          {/* Lighting */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Iluminação recomendada</h3>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-medium">
              {getLightIcon(plant.light)} {getLightLabel(plant.light)}
            </div>
          </div>

          {/* Care intervals */}
          {plant.careIntervals && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Cuidados recomendados</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["water", "fertilize", "spray"] as const).map((type) => {
                  const days = plant.careIntervals?.[type];
                  if (!days) return null;
                  return (
                    <div key={type} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-accent/50 border border-border text-center">
                      <span className="text-xl">{getCareIcon(type)}</span>
                      <span className="text-xs font-semibold text-foreground">{getCareLabel(type)}</span>
                      <span className="text-xs text-muted-foreground">a cada {days}d</span>
                    </div>
                  );
                })}
              </div>

              {/* Care amounts */}
              {(plant.careAmounts?.water || plant.careAmounts?.fertilizer) && (
                <div className="flex gap-3 mt-2">
                  {plant.careAmounts?.water && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/40 text-sm">
                      <span>💧</span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{plant.careAmounts.water} ml</span> por rega
                      </span>
                    </div>
                  )}
                  {plant.careAmounts?.fertilizer && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/40 text-sm">
                      <span>🌱</span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{plant.careAmounts.fertilizer} ml</span> fertilizante
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI tip */}
          {plant.tip && (
            <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-primary/20 bg-accent/30">
              <span className="text-base shrink-0">💡</span>
              <p className="text-sm text-foreground italic">{plant.tip}</p>
            </div>
          )}

          {/* Fertilizer types */}
          {plant.fertilizerTypes && plant.fertilizerTypes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Fertilizantes recomendados</h3>
              <p className="text-xs text-muted-foreground">Disponíveis no mercado brasileiro</p>
              <div className="flex flex-wrap gap-2">
                {plant.fertilizerTypes.map((fertilizer, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent border border-border text-xs font-medium text-foreground"
                  >
                    🌿 {fertilizer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
