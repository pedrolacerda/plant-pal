import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlantForm } from "@/components/PlantForm";
import { PlantCard } from "@/components/PlantCard";
import { CareCalendar } from "@/components/CareCalendar";
import { UpcomingTasks } from "@/components/UpcomingTasks";
import { NotificationBanner } from "@/components/NotificationBanner";
import { PlantEditSheet } from "@/components/PlantEditSheet";
import { useAuth } from "@/hooks/useAuth";
import { usePlants } from "@/hooks/usePlants";
import type { Plant, LightLevel, CareIntervals, CareAmounts } from "@/lib/plantCare";
import { CalendarDays, Leaf, ListChecks, LogOut, Loader2 } from "lucide-react";

const Index = () => {
  const { user, signOut } = useAuth();
  const { plants, loading, addPlant, updatePlant, deletePlant } = usePlants(user?.id);
  const [activeTab, setActiveTab] = useState("home");
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const handleAddPlant = async (name: string, light: LightLevel, careIntervals?: CareIntervals, tip?: string, careAmounts?: CareAmounts, photo?: string) => {
    await addPlant(name, light, careIntervals, tip, careAmounts, photo);
    setActiveTab("home");
  };

  const handleEditPlant = (plant: Plant) => {
    setEditingPlant(plant);
    setEditSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌿</span>
            <h1 className="font-display text-2xl font-bold text-foreground">Meu Jardim</h1>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Cuide das suas plantas com carinho</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-1 px-5 pb-24 overflow-y-auto">
          <TabsContent value="home" className="mt-0 space-y-4">
            <NotificationBanner />
            <div className="bg-accent/60 rounded-2xl p-4 border border-border">
              <h2 className="font-display text-base font-semibold text-foreground mb-1">Próximos cuidados</h2>
              <UpcomingTasks plants={plants} />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : plants.length > 0 ? (
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-foreground">
                  Minhas plantas ({plants.length})
                </h2>
                {plants.map((plant) => (
                  <PlantCard key={plant.id} plant={plant} onDelete={(id) => deletePlant(id)} onEdit={handleEditPlant} />
                ))}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CareCalendar plants={plants} />
          </TabsContent>

          <TabsContent value="add" className="mt-0">
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">Nova planta</h2>
              <PlantForm onAdd={handleAddPlant} />
            </div>
          </TabsContent>
        </div>

        <TabsList className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto h-16 bg-card border-t border-border rounded-none grid grid-cols-3 px-2 shadow-lg z-50">
          <TabsTrigger value="home" className="flex flex-col gap-0.5 items-center data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground data-[state=active]:shadow-none rounded-none h-full">
            <ListChecks className="w-5 h-5" />
            <span className="text-[10px] font-medium">Início</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex flex-col gap-0.5 items-center data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground data-[state=active]:shadow-none rounded-none h-full">
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px] font-medium">Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="add" className="flex flex-col gap-0.5 items-center data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground data-[state=active]:shadow-none rounded-none h-full">
            <Leaf className="w-5 h-5" />
            <span className="text-[10px] font-medium">Adicionar</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PlantEditSheet
        plant={editingPlant}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onSave={(p) => updatePlant(p)}
      />
    </div>
  );
};

export default Index;
