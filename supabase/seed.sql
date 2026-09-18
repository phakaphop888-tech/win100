-- DEVELOPMENT DATA ONLY. Do not treat as production traffic.
-- Create users via Auth (Register). Then promote one profile to admin:
--   update public.profiles set role = 'admin' where id = '<uuid>';

insert into public.platform_settings (
  id, base_fare, price_per_km, min_fare, match_radius_km, gps_stale_seconds, search_timeout_seconds
) values (
  'default', 20, 10, 25, 5, 45, 90
) on conflict (id) do update set
  base_fare = excluded.base_fare,
  price_per_km = excluded.price_per_km,
  min_fare = excluded.min_fare;

insert into public.win_stands (name, address, latitude, longitude, is_active) values
  ('วิน BTS หมอชิต', 'ถนนพหลโยธิน แขวงจตุจักร กรุงเทพฯ', 13.8026, 100.5530, true),
  ('วิน สยาม', 'บริเวณสยามสแควร์ กรุงเทพฯ', 13.7460, 100.5344, true),
  ('วิน อนุสาวรีย์ชัย', 'ถนนพหลโยธิน เขตพญาไท กรุงเทพฯ', 13.7649, 100.5383, true),
  ('วิน อนุสาวรีย์ประชาธิปไตย', 'ถนนราชดำเนิน กรุงเทพฯ', 13.7567, 100.5018, true),
  ('วิน หัวลำโพง', 'สถานีรถไฟหัวลำโพง กรุงเทพฯ', 13.7373, 100.5172, true);
