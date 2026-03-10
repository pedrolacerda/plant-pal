import { useState, useRef } from "react";
import { Camera, Loader2, X, ShieldCheck, ShieldAlert, AlertTriangle, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DiagnosisResult {
  healthy: boolean;
  diagnosis: string;
  severity: "healthy" | "mild" | "moderate" | "severe";
  details: string;
  treatments: { action: string; urgency: "immediate" | "soon" | "preventive" }[];
}

interface PlantDiagnosisProps {
  plantName: string;
}

const severityConfig = {
  healthy: { icon: ShieldCheck, label: "Saudável", className: "text-primary bg-accent" },
  mild: { icon: AlertTriangle, label: "Leve", className: "text-yellow-600 bg-yellow-50" },
  moderate: { icon: ShieldAlert, label: "Moderado", className: "text-orange-600 bg-orange-50" },
  severe: { icon: Bug, label: "Grave", className: "text-destructive bg-destructive/10" },
};

const urgencyLabels: Record<string, string> = {
  immediate: "⚡ Imediato",
  soon: "🕐 Em breve",
  preventive: "🛡️ Preventivo",
};

export function PlantDiagnosis({ plantName }: PlantDiagnosisProps) {
  const [diagnosing, setDiagnosing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoPreview(base64);
      setResult(null);
      await diagnose(base64);
    };
    reader.readAsDataURL(file);
  };

  const diagnose = async (imageBase64: string) => {
    setDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnose-plant", {
        body: { imageBase64, plantName },
      });

      if (!error && data) {
        const diagnosisData = data as DiagnosisResult;
        setResult(diagnosisData);
        toast({
          title: diagnosisData.healthy ? "✅ Planta saudável!" : `⚠️ ${diagnosisData.diagnosis}`,
          description: diagnosisData.details.substring(0, 100),
        });
      } else {
        toast({
          title: "Erro no diagnóstico",
          description: "Tente novamente com outra foto.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro no diagnóstico",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const clear = () => {
    setPhotoPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const severity = result ? severityConfig[result.severity] : null;
  const SeverityIcon = severity?.icon;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
        disabled={diagnosing}
      />

      {!photoPreview ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={diagnosing}
          className="w-full rounded-xl gap-2 h-10 border-dashed"
        >
          <Camera className="w-4 h-4" />
          Diagnosticar com foto
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={photoPreview}
              alt="Foto para diagnóstico"
              className="w-full h-32 object-cover"
            />
            {diagnosing && (
              <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-medium text-foreground">Analisando...</span>
              </div>
            )}
            {!diagnosing && (
              <button
                type="button"
                onClick={clear}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {result && severity && SeverityIcon && (
            <div className="space-y-2">
              {/* Severity badge + diagnosis */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${severity.className}`}>
                <SeverityIcon className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{result.diagnosis}</span>
                  <span className="text-xs ml-2 opacity-75">({severity.label})</span>
                </div>
              </div>

              {/* Details */}
              <p className="text-xs text-muted-foreground px-1">{result.details}</p>

              {/* Treatments */}
              {result.treatments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground px-1">Tratamentos:</p>
                  {result.treatments.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted text-xs"
                    >
                      <span className="shrink-0">{urgencyLabels[t.urgency] || t.urgency}</span>
                      <span className="text-foreground">{t.action}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Retry */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs h-8"
              >
                Enviar outra foto
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
