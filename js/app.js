// ฟังก์ชันแปลงรูปแบบวันที่และเวลาภาษาไทย (แก้ไขบั๊ก RangeError เรื่อง year แล้ว)
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// ฟังก์ชันแปลงสกุลเงินบาท (THB)
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '฿0';
    return new Intl.NumberFormat('th-TH', { 
        style: 'currency', 
        currency: 'THB', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ฟังก์ชันคำนวณระยะทางทางตรง (Haversine Formula) ป้องกัน ReferenceError
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // รัศมีของโลก (เมตร)
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // ระยะทางคืนค่าเป็นเมตร
}