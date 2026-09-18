// js/auth.js

// ฟังก์ชันเช็กสถานะการเข้าสู่ระบบและสิทธิ์การใช้งาน (Role)
async function checkAuth(requiredRole = null) {
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session) {
            window.location.href = '../login.html';
            return null;
        }

        // 1. ดึงข้อมูล Profile (ใช้ .maybeSingle() เพื่อป้องกัน Error 406)
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error('Profile fetch error:', profileError);
            window.location.href = '../login.html';
            return null;
        }

        // 2. เช็ก Role สิทธิ์การเข้าถึง
        // หากระบุ requiredRole แต่ผู้ใช้ไม่ใช่ Role นั้น และไม่ใช่ admin จะปฏิเสธการเข้าถึงทันที
        if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin') {
            await Swal.fire({
                icon: 'error',
                title: 'ไม่มีสิทธิ์เข้าถึง',
                text: 'คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้',
                confirmButtonColor: '#F59E0B'
            });
            window.location.href = '../login.html';
            return null;
        }

        // 3. ตรวจสอบสถานะการอนุมัติเฉพาะ Driver
        if (profile.role === 'driver') {
            const { data: driver, error: driverError } = await supabaseClient
                .from('drivers')
                .select('approval_status')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (driverError) {
                console.error('Driver status check error:', driverError);
            }

            // หากสถานะยังไม่อนุมัติ แจ้งเตือน Popup แล้วสวิทช์ไปหน้า profile.html เพื่อดูสถานะ
            if (driver && driver.approval_status === 'pending') {
                const isProfilePage = window.location.pathname.includes('profile.html');
                if (!isProfilePage) {
                    await Swal.fire({
                        icon: 'info',
                        title: 'รอการอนุมัติบัญชี',
                        text: 'สถานะบัญชีคนขับของคุณ: pending (กรุณารอเจ้าหน้าที่ตรวจสอบ)',
                        confirmButtonText: 'ตกลง',
                        confirmButtonColor: '#F59E0B'
                    });
                    window.location.href = 'profile.html';
                    return null;
                }
            }
        }

        return { session, profile };
    } catch (err) {
        console.error('Auth check unexpected error:', err);
        window.location.href = '../login.html';
        return null;
    }
}

// ฟังก์ชันออกจากระบบ
async function logoutUser() {
    Swal.fire({
        title: 'ยืนยันการออกจากระบบ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#DC2626'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await supabaseClient.auth.signOut();
            window.location.href = '../login.html';
        }
    });
}
