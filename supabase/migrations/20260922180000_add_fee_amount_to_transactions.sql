-- Add fee_amount to transactions table for payment gateway / processor commissions (e.g. SimplePay, Stripe, PayPal)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT NULL;
