import { useState } from 'react';
import { Search, Bell, Shield, AlertCircle, CheckCircle } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null); // null | 'safe' | 'fraud'

  const handleDetect = () => {
    if (!url.trim()) return;

    // Replace this later with real detection (API/ML)
    const isFraud = url.toLowerCase().includes('phish') || Math.random() > 0.5;
    setResult(isFraud ? 'fraud' : 'safe');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Navbar */}
      <header className="bg-[#150050] border-b border-[#3F0071] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shield className="text-[#FB2576]" size={36} />
          <h1 className="text-3xl font-bold">FraudGuard</h1>
        </div>
        <div className="flex items-center gap-6">
          <Bell size={28} className="cursor-pointer hover:text-[#FB2576]" />
          <div className="w-12 h-12 bg-[#FB2576] rounded-full flex items-center justify-center text-xl font-bold">
            A
          </div>
        </div>
      </header>

      {/* Main Centered Card */}
      <main className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="w-full max-w-3xl">
          <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-[#FB2576] to-purple-500 bg-clip-text text-transparent">
            Fraud URL Detector
          </h2>

          <div className="bg-[#150050] rounded-3xl p-10 shadow-2xl border border-[#3F0071]">
            <textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL here... (e.g. https://fakebank-login.com)"
              className="w-full h-48 p-6 bg-black rounded-2xl border border-[#3F0071] focus:border-[#FB2576] focus:outline-none resize-none text-lg placeholder-gray-500"
            />

            {/* Result */}
            {result && (
              <div className={`mt-6 p-6 rounded-2xl flex items-center gap-4 text-2xl font-bold ${
                result === 'safe'
                  ? 'bg-green-900/40 border border-green-500 text-green-400'
                  : 'bg-red-900/40 border border-red-500 text-red-400'
              }`}>
                {result === 'safe' ? <CheckCircle size={40} /> : <AlertCircle size={40} />}
                {result === 'safe' ? 'Safe URL' : 'Fraudulent URL Detected!'}
              </div>
            )}

            <div className="mt-8 text-right">
              <button
                onClick={handleDetect}
                disabled={!url.trim()}
                className={`px-12 py-5 rounded-2xl font-bold text-xl flex items-center gap-4 mx-auto transition-all transform hover:scale-105
                  ${url.trim()
                    ? 'bg-[#FB2576] hover:bg-pink-600 shadow-2xl'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <Search size={32} />
                Detect Fraud
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}