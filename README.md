@echo off
chcp 65001 > nul
echo กำลังสร้างโครงสร้างโฟลเดอร์และไฟล์สำหรับโปรเจกต์ วิน100...

:: สร้างโฟลเดอร์ย่อย
mkdir user driver admin js supabase 2>nul

:: สร้างไฟล์ใน Root
type nul > index.html
type nul > login.html
type nul > register.html
type nul > register-driver.html
type nul > README.md
type nul > .gitignore

:: สร้างไฟล์ใน user/
type nul > user\dashboard.html
type nul > user\booking.html
type nul > user\active-job.html
type nul > user\history.html
type nul > user\profile.html

:: สร้างไฟล์ใน driver/
type nul > driver\dashboard.html
type nul > driver\jobs.html
type nul > driver\job-detail.html
type nul > driver\earnings.html
type nul > driver\notifications.html
type nul > driver\profile.html

:: สร้างไฟล์ใน admin/
type nul > admin\dashboard.html
type nul > admin\drivers.html
type nul > admin\driver-detail.html
type nul > admin\jobs.html
type nul > admin\users.html
type nul > admin\reports.html
type nul > admin\notifications.html
type nul > admin\settings.html

:: สร้างไฟล์ใน js/
type nul > js\supabase.js
type nul > js\app.js
type nul > js\auth.js
type nul > js\location.js
type nul > js\map.js
type nul > js\user.js
type nul > js\driver.js
type nul > js\admin.js

:: สร้างไฟล์ใน supabase/
type nul > supabase\schema.sql
type nul > supabase\policies.sql
type nul > supabase\seed.sql

echo สร้างโฟลเดอร์และไฟล์ทั้งหมดเสร็จเรียบร้อยแล้ว!
pause