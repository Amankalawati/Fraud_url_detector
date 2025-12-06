const express = require('express');
const cors = require('cors');
const { checkURL } = require('./utils/checker');
const axios = require('axios');
const https = require('https');
const http = require('http');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🔒 URL Security Checker API',
    version: '2.0.0',
    description: 'Check URLs and expand short URLs for security analysis',
    endpoints: {
      check: 'POST /check - Analyze URL security',
      expand: 'POST /expand-url - Expand short URL to original',
      health: 'GET /health - API health status',
      batch: 'POST /check/batch - Batch analysis'
    },
    features: [
      'Automatic short URL expansion',
      'Multi-engine security analysis',
      'Real-time threat detection',
      'Domain age verification'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    endpoints: [
      '/',
      '/health',
      '/expand-url (POST)',
      '/check (POST)',
      '/check/batch (POST)'
    ]
  });
});

// ============================
// URL EXPANSION FUNCTION
// ============================

async function expandURL(shortUrl) {
  try {
    console.log(`\n🔗 [EXPAND] Starting expansion for: ${shortUrl}`);
    
    // Normalize URL
    let url = shortUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // List of known short URL services
    const shortUrlServices = new Set([
      'tinyurl.com', 'bit.ly', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
      'adf.ly', 't.co', 'lnkd.in', 'fb.me', 'tr.im', 'tiny.cc',
      'url.ie', 'shrtco.de', 'cutt.ly', 'shorturl.at', 'rb.gy',
      'soo.gd', 's2r.co', 'click.ru', 'x.co', 'qr.net', 'v.gd',
      'cur.lv', 'short.ie', 'ity.im', 'clck.ru', 'u.to', 'j.mp',
      'bc.vc', 'db.tt', 'po.st', 'v.gd', 'short.cm', 'shorte.st'
    ]);

    // Extract domain to check if it's a short URL service
    const domain = new URL(url).hostname.toLowerCase();
    const isShortUrlService = Array.from(shortUrlServices).some(service => 
      domain.includes(service)
    );

    console.log(`📊 [EXPAND] Domain: ${domain}, Is short URL: ${isShortUrlService}`);

    // If not a short URL service, return original
    if (!isShortUrlService) {
      console.log(`✅ [EXPAND] Not a short URL service, returning original`);
      return url;
    }

    // Try multiple expansion methods
    const methods = [
      methodAxiosWithRedirects,
      methodHttpHeadRequest,
      methodHttpGetRequest,
      methodUnshortenAPI,
      methodManualRedirect
    ];

    let resultUrl = url;
    let lastError = null;

    for (const method of methods) {
      try {
        console.log(`🔄 [EXPAND] Trying method: ${method.name}`);
        resultUrl = await method(url);
        
        // Check if expansion was successful
        if (resultUrl && resultUrl !== url && !isSameShortUrlService(url, resultUrl)) {
          console.log(`✅ [EXPAND] Success with ${method.name}: ${url} → ${resultUrl}`);
          return resultUrl;
        }
      } catch (error) {
        lastError = error;
        console.log(`⚠️ [EXPAND] Method ${method.name} failed: ${error.message}`);
        // Continue to next method
      }
    }

    // If all methods failed, try special handling for specific services
    console.log(`🔄 [EXPAND] Trying service-specific handling...`);
    
    if (domain.includes('tinyurl.com')) {
      try {
        const tinyResult = await expandTinyURL(url);
        if (tinyResult && tinyResult !== url) {
          console.log(`✅ [EXPAND] TinyURL specific expansion successful: ${tinyResult}`);
          return tinyResult;
        }
      } catch (error) {
        console.log(`⚠️ [EXPAND] TinyURL specific handling failed: ${error.message}`);
      }
    } else if (domain.includes('bit.ly')) {
      try {
        const bitlyResult = await expandBitly(url);
        if (bitlyResult && bitlyResult !== url) {
          console.log(`✅ [EXPAND] Bitly specific expansion successful: ${bitlyResult}`);
          return bitlyResult;
        }
      } catch (error) {
        console.log(`⚠️ [EXPAND] Bitly specific handling failed: ${error.message}`);
      }
    }

    // If we still have the original URL, throw error
    if (resultUrl === url && isShortUrlService) {
      throw new Error(`Failed to expand short URL. Service might be blocking requests or requires CAPTCHA.`);
    }

    console.log(`⚠️ [EXPAND] Returning possibly unexpanded URL: ${resultUrl}`);
    return resultUrl;

  } catch (error) {
    console.error(`❌ [EXPAND] Critical error: ${error.message}`);
    throw error;
  }
}

// Helper to check if two URLs are from same short URL service
function isSameShortUrlService(url1, url2) {
  try {
    const domain1 = new URL(url1).hostname.toLowerCase();
    const domain2 = new URL(url2).hostname.toLowerCase();
    
    const shortUrlServices = [
      'tinyurl.com', 'bit.ly', 'goo.gl', 'ow.ly', 'is.gd',
      'adf.ly', 't.co', 'lnkd.in', 'fb.me', 'cutt.ly'
    ];
    
    const isService1 = shortUrlServices.some(s => domain1.includes(s));
    const isService2 = shortUrlServices.some(s => domain2.includes(s));
    
    return isService1 && isService2;
  } catch {
    return false;
  }
}

// ============================
// EXPANSION METHODS
// ============================

// Method 1: Axios with manual redirect handling
async function methodAxiosWithRedirects(url) {
  const response = await axios({
    method: 'GET',
    url: url,
    maxRedirects: 0, // Don't follow automatically
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    }
  });

  // Check for redirect
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.location || response.headers.Location;
    if (location) {
      return new URL(location, url).href;
    }
  }

  // Parse HTML for meta redirects
  if (typeof response.data === 'string') {
    const html = response.data;
    
    // Meta refresh
    const metaMatch = html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^"']*url=["']?([^"']+)["']?[^>]*>/i);
    if (metaMatch && metaMatch[1]) {
      return metaMatch[1].trim();
    }
    
    // JavaScript redirect
    const jsMatch = html.match(/window\.location\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/location\.replace\s*\(\s*["']([^"']+)["']/i);
    
    if (jsMatch && jsMatch[1]) {
      return jsMatch[1].trim();
    }
  }

  return response.request?.res?.responseUrl || url;
}

// Method 2: HTTP HEAD request
async function methodHttpHeadRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const agent = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      },
      timeout: 10000
    };
    
    const req = agent.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(new URL(res.headers.location, url).href);
      } else {
        resolve(url);
      }
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HEAD request timeout'));
    });
    
    req.end();
  });
}

// Method 3: HTTP GET request
async function methodHttpGetRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const agent = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      },
      timeout: 15000
    };
    
    const req = agent.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
        
        // Early detection of redirect in headers
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy();
          resolve(new URL(res.headers.location, url).href);
        }
      });
      
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(new URL(res.headers.location, url).href);
        } else {
          // Try to parse HTML for redirects
          try {
            // Meta refresh
            const metaMatch = data.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^"']*url=["']?([^"']+)["']?[^>]*>/i);
            if (metaMatch && metaMatch[1]) {
              resolve(metaMatch[1].trim());
              return;
            }
            
            // JavaScript redirect
            const jsMatch = data.match(/window\.location\s*=\s*["']([^"']+)["']/i);
            if (jsMatch && jsMatch[1]) {
              resolve(jsMatch[1].trim());
              return;
            }
          } catch {
            // Ignore parsing errors
          }
          
          resolve(url);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GET request timeout'));
    });
    
    req.end();
  });
}

// Method 4: Use unshorten API (public service)
async function methodUnshortenAPI(url) {
  const apis = [
    `https://unshorten.me/json/${encodeURIComponent(url)}`,
    `https://api.unshorten.io/?shortURL=${encodeURIComponent(url)}`,
    `https://unshort.link/${encodeURIComponent(url)}`
  ];
  
  for (const apiUrl of apis) {
    try {
      const response = await axios.get(apiUrl, { timeout: 5000 });
      
      if (response.data && response.data.success) {
        return response.data.resolved_url || response.data.destination || url;
      }
      
      if (response.data && response.data.resolvedURL) {
        return response.data.resolvedURL;
      }
    } catch {
      // Try next API
    }
  }
  
  throw new Error('All unshorten APIs failed');
}

// Method 5: Manual redirect with multiple attempts
async function methodManualRedirect(url) {
  let currentUrl = url;
  let redirectCount = 0;
  const maxRedirects = 5;
  
  while (redirectCount < maxRedirects) {
    try {
      const response = await axios({
        method: 'GET',
        url: currentUrl,
        maxRedirects: 0,
        timeout: 5000
      });
      
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location || response.headers.Location;
        if (location) {
          redirectCount++;
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }
      
      break;
    } catch (error) {
      if (error.response && error.response.status >= 300 && error.response.status < 400) {
        const location = error.response.headers.location || error.response.headers.Location;
        if (location) {
          redirectCount++;
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }
      throw error;
    }
  }
  
  return currentUrl;
}

// ============================
// SERVICE-SPECIFIC HANDLERS
// ============================

async function expandTinyURL(url) {
  try {
    // Try preview.tinyurl.com
    const previewUrl = url.replace('tinyurl.com', 'preview.tinyurl.com');
    const response = await axios.get(previewUrl, { timeout: 8000 });
    
    const html = response.data;
    
    // TinyURL shows destination in a specific format
    const regexes = [
      /<a[^>]*href=["']([^"']+)["'][^>]*>.*?redirected.*?<\/a>/i,
      /<div[^>]*class=["']?indent["']?[^>]*>.*?<a[^>]*href=["']([^"']+)["']/is,
      /The actual URL is.*?<a[^>]*href=["']([^"']+)["']/is,
      /destination.*?<a[^>]*href=["']([^"']+)["']/is
    ];
    
    for (const regex of regexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        const destination = match[1].trim();
        if (!destination.includes('tinyurl.com')) {
          return destination;
        }
      }
    }
    
    throw new Error('Could not find destination in TinyURL preview');
  } catch (error) {
    throw new Error(`TinyURL expansion failed: ${error.message}`);
  }
}

async function expandBitly(url) {
  try {
    // Bitly info page (add +)
    const infoUrl = url + '+';
    const response = await axios.get(infoUrl, { timeout: 8000 });
    
    const html = response.data;
    
    // Bitly shows destination in the info page
    const regexes = [
      /<div[^>]*id=["']?redirect-url["']?[^>]*>.*?<a[^>]*href=["']([^"']+)["']/is,
      /<a[^>]*href=["']([^"']+)["'][^>]*>.*?redirected.*?<\/a>/i,
      /The actual URL is.*?<a[^>]*href=["']([^"']+)["']/is
    ];
    
    for (const regex of regexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        const destination = match[1].trim();
        if (!destination.includes('bit.ly')) {
          return destination;
        }
      }
    }
    
    throw new Error('Could not find destination in Bitly info page');
  } catch (error) {
    throw new Error(`Bitly expansion failed: ${error.message}`);
  }
}

// ============================
// API ENDPOINTS
// ============================

app.post('/expand-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Valid URL is required',
        message: 'Please provide a non-empty URL string'
      });
    }

    console.log(`\n📨 [API] /expand-url request received`);
    console.log(`📤 Input URL: ${url}`);
    
    const startTime = Date.now();
    const expandedUrl = await expandURL(url);
    const responseTime = Date.now() - startTime;
    
    console.log(`📥 Output URL: ${expandedUrl}`);
    console.log(`⏱️  Response time: ${responseTime}ms`);
    
    res.json({
      success: true,
      originalUrl: url,
      expandedUrl: expandedUrl,
      isExpanded: expandedUrl !== url,
      metadata: {
        processingTime: `${responseTime}ms`,
        expandedAt: new Date().toISOString(),
        methodUsed: 'multi-method'
      }
    });
    
  } catch (error) {
    console.error(`❌ [API] /expand-url error:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to expand URL',
      message: error.message,
      originalUrl: req.body.url,
      suggestion: 'Try analyzing the URL directly in your browser first'
    });
  }
});

// Combined Check endpoint (supports both short and long URLs)
app.post('/check', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log(`\n🔍 [API] /check request for: ${url}`);
    const startTime = Date.now();
    
    // Expand if it's a short URL
    const expandedUrl = await expandURL(url);
    const finalUrl = expandedUrl || url;
    const wasExpanded = expandedUrl && expandedUrl !== url;
    
    // Perform security analysis (assuming checkURL function exists)
    const result = await checkURL(finalUrl);
    
    // Add expansion info to result
    result.success = true;
    result.originalInput = url;
    result.expandedUrl = wasExpanded ? finalUrl : null;
    result.wasExpanded = wasExpanded;
    
    // Add timing info
    result.metadata = {
      ...result.metadata,
      processingTime: `${Date.now() - startTime}ms`,
      analyzedAt: new Date().toISOString(),
      expansionPerformed: wasExpanded
    };
    
    console.log(`✅ [API] /check completed in ${Date.now() - startTime}ms`);
    console.log(`📊 Result: ${result.verdict} (Score: ${result.finalScore})`);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [API] /check error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze URL',
      message: error.message,
      originalUrl: req.body.url,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch check endpoint
app.post('/check/batch', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'URLs array required' 
      });
    }
    
    if (urls.length > 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Maximum 10 URLs allowed per batch' 
      });
    }
    
    console.log(`\n📦 [API] /check/batch request for ${urls.length} URLs`);
    
    const results = await Promise.all(
      urls.map(async (url, index) => {
        try {
          console.log(`  ${index + 1}/${urls.length}: Processing ${url}`);
          const startTime = Date.now();
          
          // Expand if short URL
          const expandedUrl = await expandURL(url);
          const finalUrl = expandedUrl || url;
          const wasExpanded = expandedUrl && expandedUrl !== url;
          
          // Perform security analysis
          const result = await checkURL(finalUrl);
          const processingTime = Date.now() - startTime;
          
          return { 
            success: true, 
            ...result,
            originalInput: url,
            expandedUrl: wasExpanded ? finalUrl : null,
            wasExpanded,
            processingTime: `${processingTime}ms`
          };
        } catch (error) {
          console.error(`  ❌ Failed to process ${url}: ${error.message}`);
          return { 
            success: false,
            url, 
            error: error.message,
            finalScore: 0,
            verdict: 'ERROR',
            processingTime: '0ms'
          };
        }
      })
    );
    
    console.log(`✅ [API] /check/batch completed successfully`);
    
    res.json({
      success: true,
      batchId: Date.now(),
      total: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API] Batch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Batch analysis failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.path} does not exist`,
    availableEndpoints: [
      { method: 'GET', path: '/', description: 'API documentation' },
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'POST', path: '/expand-url', description: 'Expand short URLs' },
      { method: 'POST', path: '/check', description: 'Security analysis' },
      { method: 'POST', path: '/check/batch', description: 'Batch analysis' }
    ]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
==========================================
🚀 URL Security Checker API v2.0
==========================================
📡 Backend running on: http://localhost:${PORT}
🌐 API Documentation: http://localhost:${PORT}/
✅ Health Check: http://localhost:${PORT}/health
🔄 URL Expansion: POST /expand-url
🔍 Security Analysis: POST /check
📦 Batch Analysis: POST /check/batch
==========================================
⚡ URL Expansion Features:
✅ Multi-method expansion (5 different methods)
✅ Service-specific handling (TinyURL, Bitly, etc.)
✅ Automatic fallback mechanisms
✅ Real-time redirect following
✅ HTML parsing for hidden redirects
==========================================
⚡ Ready to receive requests
==========================================
  `);
});

// Export for testing
module.exports = { 
  app, 
  expandURL,
  methodAxiosWithRedirects,
  methodHttpHeadRequest,
  methodHttpGetRequest,
  methodUnshortenAPI,
  methodManualRedirect,
  expandTinyURL,
  expandBitly 
};