import { useState, useRef, useEffect } from "react";
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
import type { Plant, LightLevel, CareIntervals } from "@/lib/plantCare";
import { getLightIcon, getLightLabel, getCareLabel, getCareIcon } from "@/lib/plantCare";
import { Camera, CalendarIcon, Save, X, Sparkles, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_CARE_INTERVALS: Record<LightLevel, CareIntervals> = {
  low: { water: 7, fertilize: 30, spray: 10 },
  medium: { water: 4, fertilize: 21, spray: 7 },
  high: { water: 2, fertilize: 14, spray: 5 },
};

interface PlantEditSheetProps {
  plant: Plant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedPlant: Plant) => void;
  autoFetchAI?: boolean;
}

const LIGHT_OPTIONS: LightLevel[] = ["low", "medium", "high"];
const CARE_TYPES = ["water", "fertilize", "spray"] as const;

export function PlantEditSheet({ plant, open, onOpenChange, onSave, autoFetchAI }: PlantEditSheetProps) {
  const [light, setLight] = useState<LightLevel>(plant?.light || "medium");
  const [photo, setPhoto] = useState<string | undefined>(plant?.photo);
  const [nextCareDates, setNextCareDates] = useState<Record<string, string | undefined>>(
    plant?.nextCareDates || {}
  );
  const [lastCareDates, setLastCareDates] = useState<Record<string, string | undefined>>({});
  const [waterAmount, setWaterAmount] = useState<string>(
    plant?.careAmounts?.water?.toString() ?? ""
  );
  const [fertilizerAmount, setFertilizerAmount] = useState<string>(
    plant?.careAmounts?.fertilizer?.toString() ?? ""
  );
  // Editable care intervals
  const [careIntervals, setCareIntervals] = useState<CareIntervals>(
    plant?.careIntervals && plant.careIntervals.water
      ? plant.careIntervals
      : DEFAULT_CARE_INTERVALS[plant?.light || "medium"]
  );
  // AI suggestion state
  const [fetchingAI, setFetchingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    waterDays: number; fertilizeDays: number; sprayDays: number;
    waterAmount?: number; fertilizerAmount?: number;
    tip?: string; fertilizerHint?: string;
    fertilizerTypes?: string[];
  } | null>(null);
  const [appliedAITip, setAppliedAITip] = useState<string | undefined>(undefined);
  const [appliedAIFertilizerTypes, setAppliedAIFertilizerTypes] = useState<string[] | undefined>(undefined);
  const [didAutoFetch, setDidAutoFetch] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Reset state when plant changes
  const [lastPlantId, setLastPlantId] = useState<string | null>(null);
  if (plant && plant.id !== lastPlantId) {
    setLastPlantId(plant.id);
    setLight(plant.light);
    setPhoto(plant.photo);
    setNextCareDates(plant.nextCareDates || {});
    setLastCareDates({});
    setWaterAmount(plant.careAmounts?.water?.toString() ?? "");
    setFertilizerAmount(plant.careAmounts?.fertilizer?.toString() ?? "");
    setCareIntervals(
      plant.careIntervals && plant.careIntervals.water
        ? plant.careIntervals
        : DEFAULT_CARE_INTERVALS[plant.light]
    );
    setAiSuggestion(null);
    setAppliedAITip(undefined);
    setAppliedAIFertilizerTypes(undefined);
    setDidAutoFetch(false);
  }

  // Auto-fetch AI and pre-fill when opened with autoFetchAI flag
  useEffect(() => {
    if (open && autoFetchAI && plant && !didAutoFetch) {
      setDidAutoFetch(true);
      let cancelled = false;
      const doFetch = async () => {
        setFetchingAI(true);
        try {
          const { data, error } = await supabase.functions.invoke("plant-care", {
            body: { plantName: plant.name, light: plant.light },
          });
          if (cancelled) return;
          if (!error && data) {
            setCareIntervals({
              water: data.waterDays,
              fertilize: data.fertilizeDays,
              spray: data.sprayDays,
            });
            if (data.waterAmount) setWaterAmount(data.waterAmount.toString());
            if (data.fertilizerAmount) setFertilizerAmount(data.fertilizerAmount.toString());
            if (data.tip) setAppliedAITip(data.tip);
            if (data.fertilizerTypes) setAppliedAIFertilizerTypes(data.fertilizerTypes);
            toast({ title: "✨ Cuidados sugeridos pela IA", description: data.tip || "Programa de cuidados preenchido. Revise e salve." });
          }
        } catch {
          // silent — user can still edit manually
        } finally {
          if (!cancelled) setFetchingAI(false);
        }
      };
      doFetch();
      return () => { cancelled = true; };
    }
    if (!open) {
      setDidAutoFetch(false);
    }
  }, [open, autoFetchAI, plant, didAutoFetch]);

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

  const handleLastCareDateChange = (type: string, date: Date | undefined) => {
    setLastCareDates((prev) => ({
      ...prev,
      [type]: date ? date.toISOString().split("T")[0] : undefined,
    }));
    // Auto-calculate next care date = last care date + interval
    if (date) {
      const interval = careIntervals[type as keyof CareIntervals];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + interval);
      setNextCareDates((prev) => ({
        ...prev,
        [type]: nextDate.toISOString().split("T")[0],
      }));
    }
  };

  const handleIntervalChange = (type: keyof CareIntervals, value: string) => {
    const days = parseInt(value) || 1;
    setCareIntervals((prev) => ({ ...prev, [type]: days }));
    // If a last care date is set for this type, recalculate next care date
    const lastDate = lastCareDates[type];
    if (lastDate) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + days);
      setNextCareDates((prev) => ({
        ...prev,
        [type]: nextDate.toISOString().split("T")[0],
      }));
    }
  };

  const fetchAISuggestionFor = async (plantName: string, plantLight: LightLevel, applyDirectly = false) => {
    setFetchingAI(true);
    setAiSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("plant-care", {
        body: { plantName, light: plantLight },
      });
      if (!error && data) {
        if (applyDirectly) {
          // Pre-fill forms directly instead of showing a preview card
          setCareIntervals({
            water: data.waterDays,
            fertilize: data.fertilizeDays,
            spray: data.sprayDays,
          });
          if (data.waterAmount) setWaterAmount(data.waterAmount.toString());
          if (data.fertilizerAmount) setFertilizerAmount(data.fertilizerAmount.toString());
          if (data.tip) setAppliedAITip(data.tip);
          if (data.fertilizerTypes) setAppliedAIFertilizerTypes(data.fertilizerTypes);
          toast({ title: "✨ Cuidados sugeridos pela IA", description: data.tip || "Programa de cuidados preenchido. Revise e salve." });
        } else {
          setAiSuggestion(data);
        }
      } else {
        toast({
          title: "Erro ao consultar IA",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro ao consultar IA",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setFetchingAI(false);
    }
  };

  const fetchAISuggestion = () => fetchAISuggestionFor(plant.name, light);

  const acceptAISuggestion = () => {
    if (!aiSuggestion) return;
    setCareIntervals({
      water: aiSuggestion.waterDays,
      fertilize: aiSuggestion.fertilizeDays,
      spray: aiSuggestion.sprayDays,
    });
    if (aiSuggestion.waterAmount) setWaterAmount(aiSuggestion.waterAmount.toString());
    if (aiSuggestion.fertilizerAmount) setFertilizerAmount(aiSuggestion.fertilizerAmount.toString());
    // Recalculate next care dates if last care dates are set
    for (const type of CARE_TYPES) {
      const lastDate = lastCareDates[type];
      if (lastDate) {
        const interval = type === "water" ? aiSuggestion.waterDays
          : type === "fertilize" ? aiSuggestion.fertilizeDays
          : aiSuggestion.sprayDays;
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + interval);
        setNextCareDates((prev) => ({
          ...prev,
          [type]: nextDate.toISOString().split("T")[0],
        }));
      }
    }
    toast({ title: "✅ Sugestão aplicada!", description: "Revise e salve quando estiver pronto." });
    setAiSuggestion(null);
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
      careIntervals,
      nextCareDates: {
        water: nextCareDates.water,
        fertilize: nextCareDates.fertilize,
        spray: nextCareDates.spray,
      },
      careAmounts: {
        water: waterAmount ? Number(waterAmount) : undefined,
        fertilizer: fertilizerAmount ? Number(fertilizerAmount) : undefined,
      },
      tip: aiSuggestion?.tip ?? appliedAITip ?? plant.tip,
      fertilizerTypes: aiSuggestion?.fertilizerTypes ?? appliedAIFertilizerTypes ?? plant.fertilizerTypes,
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

          {/* Care routine program (intervals) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">
                Programa de cuidados (intervalos)
              </Label>
            </div>
            {CARE_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-lg">{getCareIcon(type)}</span>
                <span className="text-sm font-medium text-foreground w-24">
                  {getCareLabel(type)}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={careIntervals[type]}
                    onChange={(e) => handleIntervalChange(type, e.target.value)}
                    className="rounded-xl h-10 w-20"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">dias</span>
                </div>
              </div>
            ))}

            {/* AI suggest button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAISuggestion}
              disabled={fetchingAI}
              className="w-full h-10 rounded-xl gap-2 border-primary/30 text-primary hover:bg-accent"
            >
              {fetchingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Consultando IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Sugerir programa de cuidados com IA
                </>
              )}
            </Button>

            {/* AI suggestion preview card */}
            {aiSuggestion && (
              <div className="rounded-xl border border-primary/30 bg-accent/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Sugestão da IA</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {([
                    { type: "water", days: aiSuggestion.waterDays, label: "Rega" },
                    { type: "fertilize", days: aiSuggestion.fertilizeDays, label: "Adubação" },
                    { type: "spray", days: aiSuggestion.sprayDays, label: "Spray" },
                  ] as const).map((item) => (
                    <div key={item.type} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/60">
                      <span className="text-lg">{getCareIcon(item.type)}</span>
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-semibold text-foreground">a cada {item.days}d</span>
                    </div>
                  ))}
                </div>
                {aiSuggestion.waterAmount && (
                  <p className="text-xs text-muted-foreground">💧 Água: {aiSuggestion.waterAmount} ml/rega</p>
                )}
                {aiSuggestion.fertilizerAmount && (
                  <p className="text-xs text-muted-foreground">🌱 Fertilizante: {aiSuggestion.fertilizerAmount} ml/adubação</p>
                )}
                {aiSuggestion.tip && (
                  <p className="text-xs text-muted-foreground italic">💡 {aiSuggestion.tip}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={acceptAISuggestion}
                    className="flex-1 rounded-xl gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Aplicar sugestão
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiSuggestion(null)}
                    className="rounded-xl gap-1 text-muted-foreground"
                  >
                    <X className="w-3 h-3" />
                    Descartar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Last care dates */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Último cuidado realizado
            </Label>
            <p className="text-[11px] text-muted-foreground px-1 -mt-1">
              Informe quando realizou cada cuidado e a próxima data será reagendada automaticamente
            </p>
            {CARE_TYPES.map((type) => {
              const dateStr = lastCareDates[type];
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
                        {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => handleLastCareDateChange(type, d)}
                        disabled={(d) => d > new Date()}
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
                      onClick={() => {
                        setLastCareDates((prev) => ({ ...prev, [type]: undefined }));
                      }}
                      className="p-1 h-8 w-8"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Next care dates (computed or manual) */}
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
