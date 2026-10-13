
-- Materialized view for O(1) credit balance lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.credit_balance_view AS
SELECT user_id, COALESCE(SUM(delta), 0)::integer AS balance,
       MAX(created_at) AS last_transaction_at
FROM public.credit_transactions
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_balance_view_user ON public.credit_balance_view(user_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_credit_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.credit_balance_view;
  RETURN NULL;
END;
$$;

-- Trigger to auto-refresh after credit transactions
CREATE TRIGGER trg_refresh_credit_balance
AFTER INSERT ON public.credit_transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_credit_balance();

-- Index for fast message pagination
CREATE INDEX IF NOT EXISTS idx_peer_messages_session_created ON public.peer_messages(session_id, created_at DESC);

-- Index for device session lookups
CREATE INDEX IF NOT EXISTS idx_device_sessions_device_hash ON public.device_sessions(device_id_hash);

-- Index for credit transaction user lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type);
