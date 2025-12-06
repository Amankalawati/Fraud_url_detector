import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Backend API URL
const API_BASE_URL = 'http://localhost:3000';

const Dashboard = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanStep, setScanStep] = useState(0); 
  const [recentScans, setRecentScans] = useState([]);
  const [scanMode, setScanMode] = useState('analyzeUrl'); // 'analyzeUrl' or 'analyzeShortUrl'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // --- QR State ---
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrTab, setQrTab] = useState('upload'); // 'upload' or 'camera'
  const [qrError, setQrError] = useState(null);
  const [qrData, setQrData] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // --- Animation Effect ---
  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setScanStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 800);
      return () => clearInterval(interval);
    } else {
      setScanStep(0);
    }
  }, [isScanning]);

  // --- Camera Cleanup Effect ---
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

// Expand short URL function - Updated version
const expandShortUrl = async (shortUrl) => {
  try {
    setError(null);
    setResult(null);
    
    // Call backend to expand URL (bypasses CORS)
    const response = await axios.post(`${API_BASE_URL}/expand-url`, { 
      url: shortUrl 
    }, { 
      timeout: 10000 
    });
    
    if (response.data.success) {
      return response.data.expandedUrl;
    } else {
      throw new Error(response.data.error || 'Failed to expand URL');
    }
    
  } catch (error) {
    console.error('URL expansion error:', error);
    
    // Fallback: Try client-side expansion as last resort
    try {
      // Create a hidden iframe to trigger redirects
      return await clientSideExpandFallback(shortUrl);
    } catch (fallbackError) {
      console.error('Fallback expansion failed:', fallbackError);
      throw new Error('Failed to expand short URL. The server may be blocking expansion requests.');
    }
  }
};

// Client-side fallback method (less reliable)
const clientSideExpandFallback = (shortUrl) => {
  return new Promise((resolve, reject) => {
    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'absolute';
    iframe.style.visibility = 'hidden';
    
    let finalUrl = shortUrl;
    let attempts = 0;
    const maxAttempts = 5;
    
    const checkUrl = () => {
      attempts++;
      try {
        // Try to get iframe's current URL
        const iframeUrl = iframe.contentWindow.location.href;
        
        if (iframeUrl && iframeUrl !== 'about:blank') {
          finalUrl = iframeUrl;
          
          // Check if it's still a short URL
          const shortUrlPatterns = [
            'tinyurl.com', 'bit.ly', 'shorturl.at', 'ow.ly', 't.co',
            'goo.gl', 'is.gd', 'buff.ly', 'shorte.st', 'adf.ly'
          ];
          
          const isStillShort = shortUrlPatterns.some(pattern => 
            iframeUrl.includes(pattern)
          );
          
          if (!isStillShort || attempts >= maxAttempts) {
            document.body.removeChild(iframe);
            resolve(finalUrl);
          } else {
            setTimeout(checkUrl, 500);
          }
        } else if (attempts >= maxAttempts) {
          document.body.removeChild(iframe);
          resolve(shortUrl); // Return original if can't expand
        } else {
          setTimeout(checkUrl, 500);
        }
      } catch (e) {
        // CORS error - can't access iframe URL
        if (attempts >= maxAttempts) {
          document.body.removeChild(iframe);
          resolve(shortUrl); // Return original
        } else {
          setTimeout(checkUrl, 500);
        }
      }
    };
    
    iframe.onload = checkUrl;
    iframe.src = shortUrl;
    document.body.appendChild(iframe);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      resolve(shortUrl); // Return original on timeout
    }, 10000);
  });
};

  // --- Main Scan Logic ---
  const handleScan = async (targetUrl = url) => {
    if (!targetUrl.trim()) return;
    
    setIsScanning(true);
    setResult(null);
    setError(null);

    try {
      let finalUrl = targetUrl;
      let originalUrl = targetUrl;
      
      // If scan mode is "Analyze Short URL", expand it first
      if (scanMode === 'analyzeShortUrl') {
        setScanStep(0);
        setIsScanning(true);
        
        // Show expansion step
        setScanStep(1);
        await new Promise(r => setTimeout(r, 800));
        
        try {
          finalUrl = await expandShortUrl(targetUrl);
          setScanStep(2);
          await new Promise(r => setTimeout(r, 800));
          
          // Update the input field with expanded URL
          setUrl(finalUrl);
          
          // Show that we're analyzing the expanded URL
          setScanStep(3);
        } catch (expandError) {
          throw new Error(`Short URL expansion failed: ${expandError.message}`);
        }
      }

      // If called via QR, update the input box too
      if (targetUrl !== url) setUrl(targetUrl);

      // Proceed with analysis
      setScanStep(4);
      await new Promise(r => setTimeout(r, 500));
      
      const response = await axios.post(`${API_BASE_URL}/check`, { 
        url: finalUrl,
        originalUrl: scanMode === 'analyzeShortUrl' ? originalUrl : null 
      }, { timeout: 45000 });

      if (response.data.success === false) {
        throw new Error(response.data.error || 'Scan failed');
      }

      const scanResult = response.data;
      
      // If we analyzed a short URL, add that info to the result
      if (scanMode === 'analyzeShortUrl') {
        scanResult.originalShortUrl = originalUrl;
        scanResult.expandedUrl = finalUrl;
      }
      
      setResult(scanResult);
      
      setRecentScans(prev => [
        { 
          url: scanResult.url, 
          score: scanResult.finalScore, 
          verdict: scanResult.verdict, 
          timestamp: new Date(),
          wasShortUrl: scanMode === 'analyzeShortUrl'
        },
        ...prev.slice(0, 5)
      ]);

    } catch (error) {
      console.error('Scan error:', error);
      let msg = 'Analysis failed. Target unreachable or server error.';
      if (error.code === 'ECONNABORTED') msg = 'Timeout: Deep scan engines took too long.';
      else if (error.message?.includes('Short URL expansion failed')) msg = error.message;
      else if (error.response?.data?.error) msg = error.response.data.error;
      setError(msg);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle scan with current mode
  const handleScanClick = () => {
    handleScan(url);
  };

  // Handle mode change
  const handleModeChange = (mode) => {
    setScanMode(mode);
    setIsDropdownOpen(false);
    
    // Update placeholder text based on mode
    if (mode === 'analyzeShortUrl') {
      setError(null);
      setResult(null);
    }
  };

  // --- QR Logic: Handle File Upload ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setQrError(null);
    
    // Check if jsQR is available
    if (typeof window.jsQR === 'undefined') {
      // Dynamically load jsQR if not available
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.onload = () => processQRFile(file);
      script.onerror = () => {
        setQrError('Failed to load QR scanner library. Please try camera scanning.');
      };
      document.head.appendChild(script);
    } else {
      processQRFile(file);
    }
  };

  const processQRFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to process image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Use jsQR to decode
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        
        if (code) {
          setQrData(code.data);
          closeQRModal();
          handleScan(code.data);
        } else {
          // Try alternative approach with HTMLCanvasElement
          tryAlternativeQRDecoding(canvas);
        }
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      setQrError('Failed to read file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const tryAlternativeQRDecoding = (canvas) => {
    // Try using Tesseract.js as fallback for difficult QR codes
    if (typeof window.Tesseract === 'undefined') {
      // Load Tesseract dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = async () => {
        try {
          const { createWorker } = window.Tesseract;
          const worker = await createWorker('eng');
          const { data: { text } } = await worker.recognize(canvas);
          await worker.terminate();
          
          // Extract URLs from text (QR codes often contain URLs)
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = text.match(urlRegex);
          
          if (urls && urls.length > 0) {
            setQrData(urls[0]);
            closeQRModal();
            handleScan(urls[0]);
          } else {
            setQrError('No QR code found in image. Please ensure it\'s a clear QR code.');
          }
        } catch (err) {
          setQrError('Could not decode QR code. Try with a clearer image or use camera.');
        }
      };
      script.onerror = () => {
        setQrError('QR decoding service unavailable. Please use camera scanning.');
      };
      document.head.appendChild(script);
    }
  };

  // --- QR Logic: Start Camera ---
  const startCamera = async () => {
    setQrError(null);
    stopCamera(); // Stop any existing stream
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning interval
        scanCameraForQR();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setQrError('Camera access denied or not available. Please check permissions.');
    }
  };

  const scanCameraForQR = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const scanInterval = setInterval(() => {
      if (qrData) {
        clearInterval(scanInterval);
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (typeof window.jsQR !== 'undefined') {
          const code = window.jsQR(imageData.data, canvas.width, canvas.height, {
            inversionAttempts: 'dontInvert',
          });
          
          if (code) {
            setQrData(code.data);
            clearInterval(scanInterval);
            stopCamera();
            closeQRModal();
            handleScan(code.data);
          }
        }
      }
    }, 500); // Scan every 500ms
    
    // Cleanup on unmount or modal close
    return () => clearInterval(scanInterval);
  };

  const closeQRModal = () => {
    stopCamera();
    setShowQRModal(false);
    setQrError(null);
    setQrData(null);
    setQrTab('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const switchToCameraTab = () => {
    setQrTab('camera');
    setQrError(null);
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // --- UI Helpers ---
  const getSeverityColor = (score) => {
    if (score < 20) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score < 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    if (score < 80) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
  };

  const getVerdictGradient = (score) => {
    if (score < 20) return 'from-emerald-500 to-teal-600';
    if (score < 50) return 'from-yellow-500 to-amber-600';
    if (score < 80) return 'from-orange-500 to-red-600';
    return 'from-red-600 to-rose-700';
  };

  const formatDays = (days) => {
    if (!days) return 'Unknown';
    if (days < 30) return `${days} Days`;
    if (days < 365) return `${Math.floor(days/30)} Months`;
    return `${(days/365).toFixed(1)} Years`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.scan-mode-dropdown')) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        
        {/* Navbar */}
        <div className="flex justify-between items-center mb-20 border-b border-slate-800/60 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-100">
              Sentinel<span className="text-violet-400">Core</span>
            </span>
          </div>
          <div className="flex space-x-6 text-sm font-medium text-slate-400">
            <div className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              System Active
            </div>
            <div className="hidden md:block">v2.6.0 (Short URL & QR Module)</div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-white">
            Deconstruct the Web. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-white">
              Detect the Unseen.
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Advanced forensic engine powered by <span className="text-slate-200 font-medium">PhiShark</span>, <span className="text-slate-200 font-medium">URLert</span>, and <span className="text-slate-200 font-medium">WhoisFreaks</span>. 
            Instant threat correlations and reputation analysis. Now with <span className="text-violet-300 font-medium">Short URL expansion</span>.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className={`relative group transition-all duration-300 ${isScanning ? 'opacity-80' : 'opacity-100'}`}>
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-slate-900 border border-slate-700/50 rounded-2xl p-2 shadow-2xl">
              
              {/* QR Button */}
              <button 
                onClick={() => setShowQRModal(true)}
                disabled={isScanning}
                className="ml-2 p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-violet-400 transition-colors"
                title="Scan QR Code"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </button>

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanClick()}
                placeholder={
                  scanMode === 'analyzeShortUrl' 
                    ? "Enter short URL (tinyurl.com, bit.ly, etc.)..." 
                    : "Enter target URL or Scan QR..."
                }
                disabled={isScanning}
                className="flex-grow bg-transparent border-none text-slate-200 placeholder-slate-500 px-4 py-4 text-lg focus:outline-none focus:ring-0"
              />
              
              {/* Scan Mode Dropdown */}
              <div className="scan-mode-dropdown relative mr-2">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isScanning}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isScanning 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <span className="mr-1">
                    {scanMode === 'analyzeUrl' ? 'Analyze URL' : 'Analyze Short URL'}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 animate-fadeIn">
                    <button
                      onClick={() => handleModeChange('analyzeUrl')}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-700 transition-colors flex items-center ${
                        scanMode === 'analyzeUrl' ? 'text-violet-300 bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Analyze URL
                      <span className="ml-auto text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">Standard</span>
                    </button>
                    <button
                      onClick={() => handleModeChange('analyzeShortUrl')}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-700 transition-colors flex items-center ${
                        scanMode === 'analyzeShortUrl' ? 'text-violet-300 bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Analyze Short URL
                      <span className="ml-auto text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">New</span>
                    </button>
                    <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700 bg-slate-900/50">
                      {scanMode === 'analyzeShortUrl' 
                        ? 'Supports: tinyurl.com, bit.ly, shorturl.at, etc.' 
                        : 'Standard URL analysis'}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleScanClick}
                disabled={isScanning || !url}
                className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 ${
                  isScanning 
                    ? 'bg-slate-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-lg hover:shadow-violet-500/25 hover:scale-[1.02]'
                }`}
              >
                {isScanning ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {scanMode === 'analyzeShortUrl' ? 'Expanding...' : 'Scanning'}
                  </span>
                ) : (
                  scanMode === 'analyzeShortUrl' ? 'Expand & Analyze' : 'Analyze'
                )}
              </button>
            </div>
          </div>

          {/* Mode Indicator */}
          <div className="mt-3 flex items-center justify-center">
            {scanMode === 'analyzeShortUrl' && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 text-xs font-medium border border-violet-500/30">
                <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Short URL Mode: Will expand and analyze final destination
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3 animate-fadeIn">
              <svg className="w-5 h-5 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-rose-200 text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* QR MODAL */}
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
              
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                <h3 className="text-white font-bold text-lg">Scan QR Code</h3>
                <button onClick={closeQRModal} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800">
                <button 
                  onClick={() => setQrTab('upload')} 
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${qrTab === 'upload' ? 'bg-violet-600/20 text-violet-300 border-b-2 border-violet-500' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  Upload Image
                </button>
                <button 
                  onClick={switchToCameraTab} 
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${qrTab === 'camera' ? 'bg-violet-600/20 text-violet-300 border-b-2 border-violet-500' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  Use Camera
                </button>
              </div>

              {/* Content */}
              <div className="p-6 min-h-[300px] flex flex-col items-center justify-center bg-slate-900/50">
                
                {qrError && (
                  <div className="mb-4 w-full p-3 bg-rose-500/20 border border-rose-500/30 rounded text-rose-300 text-xs text-center">
                    {qrError}
                  </div>
                )}

                {qrData && (
                  <div className="mb-4 w-full p-3 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center">
                    QR Detected: {qrData.substring(0, 50)}...
                  </div>
                )}

                {/* TAB 1: UPLOAD */}
                {qrTab === 'upload' && (
                  <div className="text-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 hover:border-violet-500/50 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-10 h-10 mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mb-2 text-sm text-slate-400">
                          <span className="font-semibold text-violet-400">Click to upload</span> QR Image
                        </p>
                        <p className="text-xs text-slate-500">SVG, PNG, JPG, GIF (MAX. 10MB)</p>
                      </div>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        disabled={isScanning}
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-4">
                      Supported: Standard QR codes, URL QR codes
                    </p>
                  </div>
                )}

                {/* TAB 2: CAMERA */}
                {qrTab === 'camera' && (
                  <div className="w-full flex flex-col items-center">
                    <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {/* Scanning overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-violet-500 rounded-lg relative">
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-violet-400"></div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-violet-400"></div>
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-violet-400"></div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-violet-400"></div>
                          <div className="absolute inset-0 border-2 border-violet-400/30 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-400 animate-pulse">
                      Point camera at QR code...
                    </p>
                    <button
                      onClick={stopCamera}
                      className="mt-4 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
                {qrTab === 'upload' 
                  ? 'Upload a clear image of a QR code' 
                  : 'Allow camera access and point at QR code'}
              </div>
            </div>
          </div>
        )}

        {/* Scanning Animation State */}
        {isScanning && (
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="space-y-4">
              {scanMode === 'analyzeShortUrl' && (
                <>
                  <div className={`transition-all duration-500 ${scanStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="flex items-center justify-center space-x-3 text-slate-300">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                      <span>Detecting short URL service...</span>
                    </div>
                  </div>
                  <div className={`transition-all duration-500 ${scanStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="flex items-center justify-center space-x-3 text-slate-300">
                      <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
                      <span>Expanding to final destination...</span>
                    </div>
                  </div>
                  <div className={`transition-all duration-500 ${scanStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="flex items-center justify-center space-x-3 text-slate-300">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span>Target resolved: Analyzing final URL...</span>
                    </div>
                  </div>
                </>
              )}
              <div className={`transition-all duration-500 ${scanStep >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-center space-x-3 text-slate-300">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span>Querying <strong>PhiShark</strong> Intelligence...</span>
                </div>
              </div>
              <div className={`transition-all duration-500 ${scanStep >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-center space-x-3 text-slate-300">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                  <span>Validating via <strong>URLert</strong> Database...</span>
                </div>
              </div>
              <div className={`transition-all duration-500 ${scanStep >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-center space-x-3 text-slate-300">
                  <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-pulse"></div>
                  <span>Fetching <strong>WhoisFreaks</strong> Domain Age...</span>
                </div>
              </div>
            </div>
            <div className="mt-8 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-progress ${
                scanMode === 'analyzeShortUrl' ? 'w-5/6' : 'w-2/3'
              }`}></div>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !isScanning && (
          <div className="animate-fadeIn">
            
            {/* Short URL Expansion Info */}
            {result.originalShortUrl && (
              <div className="mb-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center text-violet-300 font-medium mb-2">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Short URL Expansion Complete
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Original Short URL:</span>
                        <div className="font-mono text-slate-300 truncate" title={result.originalShortUrl}>
                          {result.originalShortUrl}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Expanded Destination:</span>
                        <div className="font-mono text-slate-200 truncate" title={result.expandedUrl}>
                          {result.expandedUrl}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-4">
                    <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                      <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Successfully Expanded
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 1. Top Verdict Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Score Gauge */}
              <div className="md:col-span-2 bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getVerdictGradient(result.finalScore)}`}></div>
                <div className="flex flex-col md:flex-row items-center justify-between z-10 relative">
                  <div>
                    <h2 className="text-slate-400 font-medium mb-1 tracking-wider uppercase text-xs">Composite Risk Score</h2>
                    <div className="flex items-baseline space-x-2">
                      <span className={`text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${getVerdictGradient(result.finalScore)}`}>
                        {result.finalScore}
                      </span>
                      <span className="text-slate-500 font-medium">/ 100</span>
                    </div>
                    <div className={`inline-flex mt-4 items-center px-3 py-1 rounded-full border text-xs font-bold tracking-wide ${getSeverityColor(result.finalScore)}`}>
                      {result.verdict}
                    </div>
                  </div>
                  
                  {/* Blacklist Warning */}
                  {result.blacklistMatch ? (
                      <div className="mt-6 md:mt-0 p-4 bg-red-950/40 border border-red-500/50 rounded-xl max-w-sm">
                        <div className="flex items-center text-red-400 font-bold mb-2">
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Blacklist Match
                        </div>
                        <p className="text-red-200/80 text-sm">
                          This domain is explicitly blacklisted in your internal database.
                        </p>
                      </div>
                  ) : (
                    <div className="mt-6 md:mt-0 text-right">
                      <div className="text-slate-400 text-sm mb-1">Target Domain</div>
                      <div className="text-xl text-slate-200 font-mono">{result.domain || 'Unknown'}</div>
                      <div className="text-slate-500 text-xs mt-1">Analyzed via {API_BASE_URL}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions / Summary */}
              <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                   <h3 className="text-slate-300 font-bold mb-4">Threat Summary</h3>
                   <ul className="space-y-3">
                     {result.breakdown.length > 0 ? (
                       result.breakdown.slice(0, 3).map((item, i) => (
                         <li key={i} className="flex items-start text-sm text-slate-400">
                           <span className="text-rose-400 mr-2">➜</span> {item}
                         </li>
                       ))
                     ) : (
                       <li className="text-emerald-400 text-sm flex items-center">
                         <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                         No high-risk indicators found.
                       </li>
                     )}
                   </ul>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-800">
                   <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wider">
                     <span>Engines Active</span>
                     <span>3/3</span>
                   </div>
                   <div className="flex space-x-1 mt-2">
                     <div className="h-1 bg-violet-500 flex-1 rounded-full"></div>
                     <div className="h-1 bg-violet-500 flex-1 rounded-full"></div>
                     <div className="h-1 bg-violet-500 flex-1 rounded-full"></div>
                   </div>
                </div>
              </div>
            </div>

            {/* 2. Engine Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              
              {/* Engine: PhiShark */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-slate-300 font-bold">PhiShark</div>
                  <div className={`w-2 h-2 rounded-full ${result.details.phiSharkError ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                </div>
                <div className="text-3xl font-light text-slate-200 mb-1">
                  {result.details.phiSharkError ? 'ERR' : `${(result.details.phiSharkScore * 100).toFixed(0)}%`}
                </div>
                <div className="text-xs text-slate-500">Malicious Probability</div>
              </div>

              {/* Engine: URLert */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-slate-300 font-bold">URLert</div>
                  <div className={`w-2 h-2 rounded-full ${result.details.urlertError ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                </div>
                <div className="text-3xl font-light text-slate-200 mb-1">
                  {result.details.urlertError ? 'ERR' : result.details.urlertScore !== null ? `${(result.details.urlertScore * 100).toFixed(0)}%` : 'N/A'}
                </div>
                <div className="text-xs text-slate-500">Threat Score</div>
              </div>

              {/* Engine: WhoisFreaks */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-slate-300 font-bold">WhoisFreaks</div>
                  {result.details.domainAgeDays < 30 ? (
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30">NEW</span>
                  ) : (
                    <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">AGE</span>
                  )}
                </div>
                <div className="text-2xl font-light text-slate-200 mb-1 truncate">
                  {result.details.domainAgeError ? 'Unknown' : formatDays(result.details.domainAgeDays)}
                </div>
                <div className="text-xs text-slate-500">
                  Created: {result.details.domainCreationDate ? new Date(result.details.domainCreationDate).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              {/* Engine: Heuristics */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-slate-300 font-bold">Heuristics</div>
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">HTTPS</span>
                      <span className={result.details.https ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.details.https ? 'Secure' : 'Insecure'}
                      </span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Typosquat</span>
                      <span className={result.details.typosquatting ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                        {result.details.typosquatting ? 'Detected' : 'None'}
                      </span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Structure</span>
                      <span className={result.details.ipBased ? 'text-amber-400' : 'text-slate-200'}>
                        {result.details.ipBased ? 'IP Host' : 'Domain'}
                      </span>
                   </div>
                </div>
              </div>
            </div>

            {/* 3. Detailed Breakdown */}
            {result.breakdown && result.breakdown.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                 <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Forensic Log</h3>
                 <div className="space-y-2 font-mono text-sm">
                    {result.originalShortUrl && (
                      <div className="flex items-center text-violet-400">
                        <span className="text-slate-600 mr-4">[{new Date().toLocaleTimeString()}]</span>
                        <span>Short URL expansion: {result.originalShortUrl} → {result.expandedUrl}</span>
                      </div>
                    )}
                    {result.breakdown.map((log, index) => (
                      <div key={index} className="flex items-center">
                        <span className="text-slate-600 mr-4">[{new Date().toLocaleTimeString()}]</span>
                        <span className="text-slate-300">{log}</span>
                      </div>
                    ))}
                    <div className="flex items-center">
                        <span className="text-slate-600 mr-4">[{new Date().toLocaleTimeString()}]</span>
                        <span className="text-violet-400">Analysis complete. Final verdict generated.</span>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Scans Footer */}
        {recentScans.length > 0 && (
          <div className="mt-20 pt-10 border-t border-slate-800/50">
             <h4 className="text-slate-500 font-medium mb-4">Recent Investigations</h4>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-slate-400">
                 <thead>
                   <tr className="border-b border-slate-800">
                     <th className="pb-3 font-normal">URL</th>
                     <th className="pb-3 font-normal">Time</th>
                     <th className="pb-3 font-normal">Verdict</th>
                     <th className="pb-3 font-normal text-right">Score</th>
                     <th className="pb-3 font-normal text-center">Type</th>
                   </tr>
                 </thead>
                 <tbody>
                   {recentScans.map((scan, i) => (
                     <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                       <td className="py-3 font-mono text-slate-300 max-w-xs truncate pr-4">{scan.url}</td>
                       <td className="py-3">{new Date(scan.timestamp).toLocaleTimeString()}</td>
                       <td className="py-3">
                         <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(scan.score)}`}>
                           {scan.verdict}
                         </span>
                       </td>
                       <td className="py-3 text-right font-mono">{scan.score}</td>
                       <td className="py-3 text-center">
                         {scan.wasShortUrl ? (
                           <span className="text-xs px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded border border-violet-500/30">Short URL</span>
                         ) : (
                           <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded border border-slate-600">Standard</span>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;