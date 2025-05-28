-- Migration: Add turn_in_to_security flag to claims table
ALTER TABLE public.claims
ADD COLUMN IF NOT EXISTS turn_in_to_security BOOLEAN NOT NULL DEFAULT FALSE;
