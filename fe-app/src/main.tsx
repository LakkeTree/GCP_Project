import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google' // 👈 1. 구글 Provider 임포트
import './index.css'
import App from './App.tsx'

// 💡 2. 발급받으신 구글 클라이언트 ID 입력 (.env의 GOOGLE_CLIENT_ID와 동일한 값)
const GOOGLE_CLIENT_ID = "935566182756-asr2dmtfcsegvsuk7tfodk6kdv5chm0s.apps.googleusercontent.com";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 💡 3. App 전체를 GoogleOAuthProvider로 감싸줍니다 */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)