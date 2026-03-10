-- Add care_amounts column to plants table
ALTER TABLE public.plants ADD COLUMN care_amounts JSONB DEFAULT '{}';
