-- Migration: Create worker_distributed_locks table and lock management RPCs
-- Provides distributed leader election and lock coordination across worker replicas

CREATE TABLE IF NOT EXISTS public.worker_distributed_locks (
    lock_key text PRIMARY KEY,
    locked_by text NOT NULL,
    locked_until timestamptz NOT NULL,
    acquired_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_locks_until ON public.worker_distributed_locks(locked_until);

ALTER TABLE public.worker_distributed_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'worker_distributed_locks' AND policyname = 'Service role full access on worker_distributed_locks'
  ) THEN
    CREATE POLICY "Service role full access on worker_distributed_locks" 
      ON public.worker_distributed_locks 
      FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.worker_distributed_locks TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_worker_lock(
    p_lock_key text,
    p_worker_id text,
    p_duration_seconds int DEFAULT 90
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := now();
    v_res boolean := false;
BEGIN
    INSERT INTO public.worker_distributed_locks (lock_key, locked_by, locked_until, acquired_at)
    VALUES (p_lock_key, p_worker_id, v_now + (p_duration_seconds || ' seconds')::interval, v_now)
    ON CONFLICT (lock_key) DO UPDATE
    SET locked_by = EXCLUDED.locked_by,
        locked_until = EXCLUDED.locked_until,
        acquired_at = v_now
    WHERE worker_distributed_locks.locked_until < v_now
    RETURNING true INTO v_res;

    RETURN COALESCE(v_res, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_worker_lock(
    p_lock_key text,
    p_worker_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted boolean := false;
BEGIN
    DELETE FROM public.worker_distributed_locks
    WHERE lock_key = p_lock_key AND locked_by = p_worker_id
    RETURNING true INTO v_deleted;
    
    RETURN COALESCE(v_deleted, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_worker_lock(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_worker_lock(text, text) TO service_role;
