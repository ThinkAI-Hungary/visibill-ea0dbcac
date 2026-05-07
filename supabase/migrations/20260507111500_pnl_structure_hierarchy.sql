-- Set correct parent-child relationships for PnL Structure
UPDATE public.pnl_structure 
SET parent_id = '00000000-0000-0000-0000-000000000800' -- A. Üzemi eredmény
WHERE row_code IN ('I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.');

UPDATE public.pnl_structure 
SET parent_id = '00000000-0000-0000-0000-000000001100' -- B. Pénzügyi műveletek eredménye
WHERE row_code IN ('VIII.', 'IX.');

UPDATE public.pnl_structure 
SET parent_id = '00000000-0000-0000-0000-000000001200' -- C. Adózás előtti eredmény
WHERE row_code IN ('A.', 'B.');

UPDATE public.pnl_structure 
SET parent_id = '00000000-0000-0000-0000-000000001400' -- D. Adózott eredmény
WHERE row_code IN ('C.', 'X.');
