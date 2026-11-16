const configured = process.env.EXPO_PUBLIC_API_URL
if (!configured) {
  console.error('Thiếu EXPO_PUBLIC_API_URL. Tạo mobile/.env từ .env.example hoặc đặt biến môi trường trước khi chạy.')
  process.exit(1)
}
try {
  const url = new URL(configured)
  const response = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(6000) })
  const data = await response.json()
  if (!response.ok || data.status !== 'healthy') throw new Error(`HTTP ${response.status}`)
  console.log(`Backend hoạt động: ${url.origin}/health`)
  console.log('Máy tính kết nối được chưa chứng minh điện thoại kết nối được; hãy kiểm tra trong app trên thiết bị.')
} catch {
  console.error('Không kết nối được backend. Kiểm tra IP LAN/10.0.2.2, cùng Wi-Fi, tường lửa, cổng 8000 và --host 0.0.0.0. Expo tunnel không tự tạo tunnel cho API.')
  process.exit(1)
}
