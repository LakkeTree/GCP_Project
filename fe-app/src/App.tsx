import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import MainPage from './pages/MainPage';
import GameRankPage from './pages/GameRankPage';
import SupportedGamesPage from './pages/SupportedGamesPage';
import SupportedPaymentPage from './pages/SupportedPaymentPage';
import SearchPage from './pages/SearchPage';
import SearchResultPage from './pages/SearchResultPage';

export default function App() {
  return (
    <BrowserRouter>
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
            </Routes>
          </main>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}