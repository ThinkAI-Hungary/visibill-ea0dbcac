-- Migration: Create nav_item_jobs PGMQ queue for background NAV line item synchronization
-- ADR: A-130 and A-004 PGMQ Queues

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'nav_item_jobs') THEN
    PERFORM pgmq.create('nav_item_jobs');
  END IF;
END $$;
