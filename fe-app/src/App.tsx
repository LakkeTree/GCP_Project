import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Header from './components/Header';
import Footer from './components/Footer';
import MainPage from './pages/MainPage';
import GameRankPage from './pages/GameRankPage';
import SupportedGamesPage from './pages/SupportedGamesPage';
import SupportedPaymentPage from './pages/SupportedPaymentPage';
import SearchPage from './pages/SearchPage';
import SearchResultPage from './pages/SearchResultPage';
import MyProfilePage from './pages/MyProfilePage'; // 👈 1. 프로필 페이지 임포트

export default function App() {
  return (
    <BrowserRouter>
    <ScrollToTop /> {/* 2. BrowserRouter 바로 아래에 추가 */}
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
        <div>
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/rank" element={<GameRankPage />} />
              <Route path="/supported-games" element={<SupportedGamesPage />} />
              <Route path="/supported-payment" element={<SupportedPaymentPage />} />
              <Route path="/search" element={<SearchPage />} /> {/* 👈 검색/입력 페이지 */}
              <Route path="/search-result" element={<SearchResultPage />} /> {/* 👈 결과 페이지 */}
              <Route path="/profile" element={<MyProfilePage />} /> {/* 👈 프로필 페이지 */}
            </Routes>
          </main>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}