// js/supabase.js
const SUPABASE_URL = 'https://qpqycbhyjkpwsohbswbp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwcXljYmh5amtwd3NvaGJzd2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDU4NDQsImV4cCI6MjEwNDAyMTg0NH0.KQCJiUPDE3cSEJSVlr_zp5oQVr10IpWCHgKWQESo7PM';

// สร้าง Client และผูกใส่ window (รองรับทั้งการเรียก supabaseClient และ supabase)
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = window.supabaseClient;