-- Add stop order types to paper_order_type enum (if your column uses this enum).
-- Run in Supabase SQL editor, then reload API schema cache.
-- Skip if paper_orders.order_type is plain text.

ALTER TYPE public.paper_order_type ADD VALUE IF NOT EXISTS 'stop_market';
ALTER TYPE public.paper_order_type ADD VALUE IF NOT EXISTS 'stop_limit';
