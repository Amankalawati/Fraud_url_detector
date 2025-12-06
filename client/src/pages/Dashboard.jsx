import React, { useState } from 'react';

const Dashboard = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    if (!url.trim()) return;

    setIsScanning(true);
    setResult(null);

    // Simulate AI analysis delay (2-3 seconds)
    setTimeout(() => {
      const risk = Math.floor(Math.random() * 101);
      let colorClass = '';
      let status = '';

      if (risk < 30) {
        colorClass = 'text-green-400';
        status = 'Safe';
      } else if (risk < 70) {
        colorClass = 'text-yellow-400';
        status = 'Suspicious';
      } else {
        colorClass = 'text-red-500';
        status = 'High Risk';
      }

      setResult({ risk, colorClass, status });
      setIsScanning(false);
    }, 2500); // 2.5 seconds realistic scan time
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6 font-sans">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-16">
          <div className="text-sm font-mono text-gray-400 tracking-wider">
            Multi-Agent Forensic Engine:{' '}
            <span className="text-green-500 font-semibold">
              {isScanning ? 'SCANNING...' : 'ONLINE'}
            </span>
          </div>
          <div className="flex space-x-6 text-sm">
            <button className="text-gray-400 hover:text-white transition-colors">Documentation</button>
            <button className="text-gray-400 hover:text-white transition-colors">API</button>
            <button className="text-gray-400 hover:text-white transition-colors">Settings</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            <span className="block">Don't guess.</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Investigate.
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            The AI-Powered URL Security Checker. Detect malicious URLs, zero-day phishing, and cloaked attacks instantly.
          </p>
        </div>

        {/* URL Input Section */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center shadow-2xl">
              <div className="flex-shrink-0 text-gray-400 ml-3 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                disabled={isScanning}
                placeholder="Paste or type URL here..."
                className="flex-grow bg-transparent border-none text-lg text-gray-200 placeholder-gray-500 focus:outline-none disabled:opacity-60"
              />
              <div className="flex-shrink-0">
                <div className="h-8 w-px bg-gray-700 mx-4"></div>
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning || !url.trim()}
                className={`font-semibold py-3 px-8 rounded-xl transition-all shadow-lg ${
                  isScanning || !url.trim()
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white'
                }`}
              >
                {isScanning ? 'Scanning...' : 'Start Scan'}
              </button>
            </div>
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl -z-10 rounded-2xl"></div>
          </div>
        </div>

        {/* Loading Animation */}
        {isScanning && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-gray-800/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-10 shadow-2xl">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-cyan-400 border-r-blue-500 border-b-purple-500 border-l-pink-500 rounded-full animate-spin"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-cyan-400 text-3xl font-bold">
                    AI
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-cyan-400 mb-2">Analyzing Threat...</h3>
                  <p className="text-gray-400">Multi-agent system is inspecting URL behavior, content, and reputation</p>
                </div>
                <div className="flex space-x-3">
                  {['Phishing', 'Malware', 'Reputation', 'Cloaking'].map((agent, i) => (
                    <div key={i} className="text-xs px-3 py-1 bg-cyan-900/50 rounded-full animate-pulse" style={{ animationDelay: `${i * 300}ms` }}>
                      {agent} Agent
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && !isScanning && (
          <div className="max-w-3xl mx-auto mb-12 animate-fadeIn">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-3xl font-bold mb-6 text-center">Scan Complete</h2>
              <div className="text-center">
                <div className={`text-8xl font-extrabold ${result.colorClass} mb-4`}>
                  {result.risk}%
                </div>
                <div className="text-2xl font-semibold text-gray-300 mb-2">
                  Risk Level: <span className={result.colorClass}>{result.status}</span>
                </div>
                <p className="text-gray-500 text-sm mt-6">
                  Demo result • Real system uses live AI threat intelligence
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Anonymous Scan Button */}
        <div className="text-center mt-8">
          <button className="text-cyan-400 font-medium hover:text-cyan-300 transition-colors flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            Anonymous Scan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-24">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center">
            <div className="text-cyan-400 text-2xl font-bold mb-2">99.8%</div>
            <div className="text-gray-300">Accuracy Rate</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center">
            <div className="text-cyan-400 text-2xl font-bold mb-2">&lt;2s</div>
            <div className="text-gray-300">Average Scan Time</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center">
            <div className="text-cyan-400 text-2xl font-bold mb-2">7 Agents</div>
            <div className="text-gray-300">Multi-Agent Analysis</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-gray-500 text-sm">
        Secured by AI Forensic Engine • Demo Mode
      </div>
    </div>
  );
};

export default Dashboard;