DO $$
DECLARE
  fk_record RECORD;
BEGIN
  -- Drop any existing FK on opening_balances.partner_id -> partners(id)
  FOR fk_record IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'opening_balances'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'partner_id'
      AND ccu.table_name = 'partners'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format('ALTER TABLE opening_balances DROP CONSTRAINT IF EXISTS %I', fk_record.constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'opening_balances'
      AND constraint_name = 'opening_balances_partner_id_fk_restrict'
  ) THEN
    ALTER TABLE opening_balances
      ADD CONSTRAINT opening_balances_partner_id_fk_restrict
      FOREIGN KEY (partner_id)
      REFERENCES partners(id)
      ON DELETE RESTRICT;
  END IF;
END $$;
