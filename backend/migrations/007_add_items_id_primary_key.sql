-- Ensure items table has a technical primary key column `id` for POS and cross-module joins.
-- Safe for legacy schemas that only have business key columns (code/item_code).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'items'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE items ADD COLUMN id BIGINT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'items_id_seq'
  ) THEN
    CREATE SEQUENCE items_id_seq;
  END IF;
END $$;

ALTER SEQUENCE items_id_seq OWNED BY items.id;
ALTER TABLE items ALTER COLUMN id SET DEFAULT nextval('items_id_seq');

UPDATE items
SET id = nextval('items_id_seq')
WHERE id IS NULL;

SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 1), true);

ALTER TABLE items ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'items'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_pkey PRIMARY KEY (id);
  END IF;
END $$;
