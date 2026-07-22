-- Sync fixed_assets updates to accounty_ev_records_fixed_assets
CREATE OR REPLACE FUNCTION public.sync_ev_fixed_assets()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.accounty_ev_records_fixed_assets
    SET 
      asset_name = NEW.name,
      acquisition_cost = COALESCE(NEW.acquisition_value, 0)::bigint,
      disposal_date = NEW.disposal_date,
      disposal_type = CASE WHEN NEW.status = 'disposed' THEN COALESCE(disposal_type, 'scrapped') ELSE NULL END
    WHERE source_fixed_asset_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.accounty_ev_records_fixed_assets
    SET source_fixed_asset_id = NULL
    WHERE source_fixed_asset_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_ev_fixed_assets ON public.fixed_assets;

CREATE TRIGGER trg_sync_ev_fixed_assets
  AFTER UPDATE OR DELETE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ev_fixed_assets();
