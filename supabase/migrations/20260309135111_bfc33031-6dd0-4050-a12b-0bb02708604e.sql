
-- Create light level enum
CREATE TYPE public.light_level AS ENUM ('low', 'medium', 'high');

-- Create plants table
CREATE TABLE public.plants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  light light_level NOT NULL DEFAULT 'medium',
  photo TEXT,
  tip TEXT,
  care_intervals JSONB DEFAULT '{}',
  next_care_dates JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

-- Users can only see their own plants
CREATE POLICY "Users can view own plants"
  ON public.plants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own plants
CREATE POLICY "Users can insert own plants"
  ON public.plants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own plants
CREATE POLICY "Users can update own plants"
  ON public.plants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own plants
CREATE POLICY "Users can delete own plants"
  ON public.plants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
