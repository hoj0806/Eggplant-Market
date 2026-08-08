import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 카카오 콘솔(플랫폼 > Web)과 Supabase Redirect URLs에 등록한 주소는 http://localhost:5173 하나뿐이다.
  // 포트는 정확히 일치해야 해서, 5173이 막혔을 때 vite가 5174로 조용히 옮기면
  // 카카오 SDK가 401로 거부되고 화면에는 "지도 서비스를 불러오지 못했습니다"만 뜬다.
  // strictPort로 조용히 옮기는 대신 즉시 실패시켜 원인이 드러나게 한다.
  server: { port: 5173, strictPort: true },
});
