CREATE OR REPLACE FUNCTION public.spend_credits_atomic(
  _user_id uuid,
  _amount integer,
  _notes text DEFAULT 'Service usage',
  _reference_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, remaining integer, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance integer;
  _pool_balance integer;
  _inst_id uuid;
BEGIN
  PERFORM 1 FROM credit_transactions WHERE user_id = _user_id FOR UPDATE;
  
  SELECT COALESCE(SUM(delta), 0)::integer INTO _balance
  FROM credit_transactions WHERE user_id = _user_id;
  
  IF _balance >= _amount THEN
    INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
    VALUES (_user_id, -_amount, 'spend', _notes, _reference_id);
    RETURN QUERY SELECT true, (_balance - _amount)::integer, 'balance'::text;
    RETURN;
  END IF;
  
  SELECT institution_id INTO _inst_id FROM profiles WHERE id = _user_id;
  IF _inst_id IS NOT NULL THEN
    SELECT COALESCE(balance, 0) INTO _pool_balance
    FROM ecc_stability_pool WHERE institution_id = _inst_id FOR UPDATE;
    
    IF _pool_balance >= _amount THEN
      UPDATE ecc_stability_pool
      SET balance = balance - _amount, total_disbursed = total_disbursed + _amount
      WHERE institution_id = _inst_id;
      
      INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id, institution_id)
      VALUES (_user_id, -_amount, 'spend', _notes || ' (from stability pool)', _reference_id, _inst_id);
      
      RETURN QUERY SELECT true, 0, 'pool'::text;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT false, _balance, 'insufficient'::text;
END;
$$;