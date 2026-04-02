-- Add plant details columns for AI-populated information
ALTER TABLE public.plants ADD COLUMN scientific_name TEXT;
ALTER TABLE public.plants ADD COLUMN description TEXT;
ALTER TABLE public.plants ADD COLUMN fertilizer_types JSONB DEFAULT '[]';
