-- Repricing: two packages in TRY.
--   starter → "Takip"          ₺3.000/ay, tracker only
--   pro     → "Takip + Belge"  ₺5.000/ay, tracker + document builder
-- Seat caps removed (differentiation is by feature, not seats).
UPDATE public.plans SET name = 'Takip',         price_monthly = 3000, currency = 'TRY', max_seats = NULL, limits = '{}'                   WHERE id = 'starter';
UPDATE public.plans SET name = 'Takip + Belge', price_monthly = 5000, currency = 'TRY', max_seats = NULL, limits = '{"documents": true}' WHERE id = 'pro';
