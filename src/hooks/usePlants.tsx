import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Plant, LightLevel, CareIntervals, CareAmounts } from "@/lib/plantCare";

export function usePlants(userId: string | undefined) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("plants")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPlants(
        data.map((row: any) => ({
          id: row.id,
          name: row.name,
          light: row.light as LightLevel,
          createdAt: row.created_at,
          careIntervals: row.care_intervals as CareIntervals | undefined,
          careAmounts: row.care_amounts as CareAmounts | undefined,
          tip: row.tip ?? undefined,
          photo: row.photo ?? undefined,
          nextCareDates: row.next_care_dates as Plant["nextCareDates"] | undefined,
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const addPlant = async (name: string, light: LightLevel, careIntervals?: CareIntervals, tip?: string, careAmounts?: CareAmounts) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("plants")
      .insert({
        user_id: userId,
        name,
        light,
        care_intervals: careIntervals ?? {},
        care_amounts: careAmounts ?? {},
        tip: tip ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      setPlants((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          light: data.light as LightLevel,
          createdAt: data.created_at,
          careIntervals: data.care_intervals as any as CareIntervals | undefined,
          careAmounts: data.care_amounts as any as CareAmounts | undefined,
          tip: data.tip ?? undefined,
          photo: data.photo ?? undefined,
          nextCareDates: data.next_care_dates as any as Plant["nextCareDates"] | undefined,
        },
      ]);
    }
  };

  const updatePlant = async (updatedPlant: Plant) => {
    const { error } = await supabase
      .from("plants")
      .update({
        name: updatedPlant.name,
        light: updatedPlant.light,
        photo: updatedPlant.photo ?? null,
        tip: updatedPlant.tip ?? null,
        care_intervals: updatedPlant.careIntervals ?? {},
        care_amounts: updatedPlant.careAmounts ?? {},
        next_care_dates: updatedPlant.nextCareDates ?? {},
      })
      .eq("id", updatedPlant.id);

    if (!error) {
      setPlants((prev) => prev.map((p) => (p.id === updatedPlant.id ? updatedPlant : p)));
    }
  };

  const deletePlant = async (id: string) => {
    const { error } = await supabase.from("plants").delete().eq("id", id);
    if (!error) {
      setPlants((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return { plants, loading, addPlant, updatePlant, deletePlant, refetch: fetchPlants };
}
