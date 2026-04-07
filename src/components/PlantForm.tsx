import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { LightLevel } from "@/lib/plantCare";
import { getLightIcon, getLightLabel } from "@/lib/plantCare";
import { Leaf, Loader2, Camera, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlantFormProps {
  onAdd: (name: string, light: LightLevel, careIntervals?: undefined, tip?: undefined, careAmounts?: undefined, photo?: string, scientificName?: string, description?: undefined, fertilizerTypes?: undefined) => void;
}

const LIGHT_OPTIONS: LightLevel[] = ["low", "medium", "high"];

export function PlantForm({ onAdd }: PlantFormProps) {
  const [name, setName] = useState("");
  const [light, setLight] = useState<LightLevel>("medium");
  const [identifying, setIdentifying] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [identifiedInfo, setIdentifiedInfo] = useState<string | null>(null);
  const [identifiedScientificName, setIdentifiedScientificName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoPreview(base64);
      await identifyPlant(base64);
    };
    reader.readAsDataURL(file);
  };

  const identifyPlant = async (imageBase64: string) => {
    setIdentifying(true);
    setIdentifiedInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke("identify-plant", {
        body: { imageBase64 },
      });

      if (!error && data) {
        setName(data.name || "");
        const identifiedLight: LightLevel = data.light && LIGHT_OPTIONS.includes(data.light) ? data.light as LightLevel : light;
        setLight(identifiedLight);
        const confidence = data.confidence ?? 0;
        const sciName = data.scientificName ? ` (${data.scientificName})` : "";
        setIdentifiedInfo(
          `${data.name}${sciName} — ${confidence}% de confiança`
        );
        setIdentifiedScientificName(data.scientificName ?? null);
        toast({
          title: "📸 Planta identificada!",
          description: `${data.name}${sciName}`,
        });
      } else {
        toast({
          title: "Não foi possível identificar",
          description: "Tente outra foto ou preencha manualmente.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro na identificação",
        description: "Tente novamente ou preencha manualmente.",
        variant: "destructive",
      });
    } finally {
      setIdentifying(false);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setIdentifiedInfo(null);
    setIdentifiedScientificName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd(
      name.trim(),
      light,
      undefined,
      undefined,
      undefined,
      photoPreview ?? undefined,
      identifiedScientificName ?? undefined,
    );
    toast({
      title: "🌿 Planta adicionada!",
      description: "Configure o programa de cuidados a seguir.",
    });
    setName("");
    clearPhoto();
  };

  const isProcessing = identifying;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo upload area */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">
          Identificar por foto
        </Label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
          disabled={isProcessing}
        />

        {photoPreview ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-border">
            <img
              src={photoPreview}
              alt="Foto da planta"
              className="w-full h-40 object-cover"
            />
            {identifying && (
              <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground">Identificando planta...</span>
              </div>
            )}
            {!identifying && (
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {identifiedInfo && !identifying && (
              <div className="absolute bottom-0 left-0 right-0 bg-background/90 px-3 py-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-foreground font-medium truncate">
                  {identifiedInfo}
                </span>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-accent/30 flex flex-col items-center justify-center gap-2 transition-colors"
          >
            <Camera className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">
              Tirar foto ou escolher da galeria
            </span>
          </button>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">ou preencha manualmente</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plant-name" className="text-sm font-semibold text-foreground">
          Nome da planta
        </Label>
        <Input
          id="plant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Samambaia, Monstera..."
          className="bg-background border-border rounded-xl h-12 text-base"
          disabled={isProcessing}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Quantidade de luz</Label>
        <div className="grid grid-cols-3 gap-2">
          {LIGHT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLight(opt)}
              disabled={isProcessing}
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

      <p className="text-xs text-muted-foreground text-center">
        Após adicionar, você poderá configurar o programa de cuidados com sugestão da IA
      </p>

      <Button
        type="submit"
        disabled={!name.trim() || isProcessing}
        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
      >
        <Leaf className="w-5 h-5" />
        Adicionar planta
      </Button>
    </form>
  );
}
