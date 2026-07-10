-- Duplikátumok törlése az accounty_missing_items táblából
-- Megtartja a legelsőként (legkisebb ID-vel) bekerült sort minden (company_id, invoice_number) pároshoz a nav_detektor-ból.

DELETE FROM accounty_missing_items
WHERE source = 'nav_detektor'
AND id NOT IN (
    SELECT (array_agg(id ORDER BY created_at ASC))[1]
    FROM accounty_missing_items
    WHERE source = 'nav_detektor'
    GROUP BY company_id, invoice_number
);
