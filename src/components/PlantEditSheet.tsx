import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Plant, LightLevel } from "@/lib/plantCare";
import { getLightIcon, getLightLabel, getCareLabel, getCareIcon } from "@/lib/plantCare";
import { Camera, CalendarIcon, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlantEditSheetProps {
  plant: Plant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedPlant: Plant) => void;
}

const LIGHT_OPTIONS: LightLevel[] = ["low", "medium", "high"];
const CARE_TYPES = ["water", "fertilize", "spray"] as const;

export function PlantEditSheet({ plant, open, onOpenChange, onSave }: PlantEditSheetProps) {
  const [light, setLight] = useState<LightLevel>(plant?.light || "medium");
  const [photo, setPhoto] = useState<string | undefined>(plant?.photo);
  const [nextCareDates, setNextCareDates] = useState<Record<string, string | undefined>>(
    plant?.nextCareDates || {}
  );
  const [waterAmount, setWaterAmount] = useState<string>(
    plant?.careAmounts?.water?.toString() ?? ""
  );
  const [fertilizerAmount, setFertilizerAmount] = useState<string>(
    plant?.careAmounts?.fertilizer?.toString() ?? ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Reset state when plant changes
  const [lastPlantId, setLastPlantId] = useState<string | null>(null);
  if (plant && plant.id !== lastPlantId) {
    setLastPlantId(plant.id);
    setLight(plant.light);
    setPhoto(plant.photo);
    setNextCareDates(plant.nextCareDates || {});
    setWaterAmount(plant.careAmounts?.water?.toString() ?? "");
    setFertilizerAmount(plant.careAmounts?.fertilizer?.toString() ?? "");
  }

  if (!plant) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDateChange = (type: string, date: Date | undefined) => {
    setNextCareDates((prev) => ({
      ...prev,
      [type]: date ? date.toISOString().split("T")[0] : undefined,
    }));
  };

  const handleSave = () => {
    const changedDates: string[] = [];
    for (const type of CARE_TYPES) {
      const oldDate = plant.nextCareDates?.[type];
      const newDate = nextCareDates[type];
      if (oldDate !== newDate && newDate) {
        changedDates.push(`${getCareLabel(type)}: ${format(new Date(newDate), "dd/MM/yyyy")}`);
      }
    }

    const updatedPlant: Plant = {
      ...plant,
      light,
      photo,
      nextCareDates: {
        water: nextCareDates.water,
        fertilize: nextCareDates.fertilize,
        spray: nextCareDates.spray,
      },
      careAmounts: {
        water: waterAmount ? Number(waterAmount) : undefined,
        fertilizer: fertilizerAmount ? Number(fertilizerAmount) : undefined,
      },
    };

    onSave(updatedPlant);

    // Notify about date changes
    if (changedDates.length > 0 && "Notification" in window && Notification.permission === "granted") {
      new Notification(`📅 Datas atualizadas - ${plant.name}`, {
        body: changedDates.join("\n"),
        icon: "/icons/icon-192.png",
        tag: `date-change-${plant.id}`,
      });
    }

    toast({
      title: "✅ Planta atualizada!",
      description: changedDates.length > 0
        ? `Datas alteradas: ${changedDates.join(", ")}`
        : "Alterações salvas com sucesso.",
    });

    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto max-w-lg mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg">Editar {plant.name}</SheetTitle>
          <SheetDescription>Altere os detalhes e cuidados da sua planta</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-4 pb-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Foto da planta</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-accent/30 flex items-center justify-center overflow-hidden cursor-pointer transition-colors"
              >
                {photo ? (
                  <img src={photo} alt={plant.name} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {photo ? "Trocar foto" : "Adicionar foto"}
                </Button>
                {photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhoto(undefined)}
                    className="ml-2 rounded-xl gap-1 text-muted-foreground"
                  >
                    <X className="w-3 h-3" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Light level */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Quantidade de luz</Label>
            <div className="grid grid-cols-3 gap-2">
              {LIGHT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLight(opt)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 ${
                    light === opt
                      ? "border-primary bg-accent text-accent-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="text-2xl">{getLightIcon(opt)}</span>
                  <span className="text-xs font-medium">{getLightLabel(opt)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Care dates */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Próximas datas de cuidado
            </Label>
            {CARE_TYPES.map((type) => {
              const dateStr = nextCareDates[type];
              const date = dateStr ? new Date(dateStr) : undefined;

              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-lg">{getCareIcon(type)}</span>
                  <span className="text-sm font-medium text-foreground w-24">
                    {getCareLabel(type)}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 justify-start text-left font-normal rounded-xl h-10",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Automático"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => handleDateChange(type, d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {date && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateChange(type, undefined)}
                      className="p-1 h-8 w-8"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground px-1">
              Deixe como "Automático" para usar o intervalo calculado pela IA
            </p>
          </div>

          {/* Care amounts */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Quantidades por cuidado
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-lg">💧</span>
              <span className="text-sm font-medium text-foreground w-24">Água</span>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={waterAmount}
                  onChange={(e) => setWaterAmount(e.target.value)}
                  placeholder="Ex: 250"
                  className="rounded-xl h-10"
                />
                <span className="text-sm text-muted-foreground shrink-0">ml</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">🌱</span>
              <span className="text-sm font-medium text-foreground w-24">Fertilizante</span>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={fertilizerAmount}
                  onChange={(e) => setFertilizerAmount(e.target.value)}
                  placeholder="Ex: 100"
                  className="rounded-xl h-10"
                />
                <span className="text-sm text-muted-foreground shrink-0">ml</span>
              </div>
            </div>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            className="w-full h-12 rounded-xl text-base font-semibold gap-2"
          >
            <Save className="w-5 h-5" />
            Salvar alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
