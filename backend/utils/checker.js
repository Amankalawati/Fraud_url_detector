const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Load environment variables
require('dotenv').config();

// API Keys (store in .env for security)
const PHISHARK_API_URL = process.env.PHISHARK_API_URL || "https://phishark.net/api/check-url";
const URLERT_API_KEY = process.env.URLERT_API_KEY || "sk_ptOa4LXnxETrntMqJ0PZ9iR6jgLYUaMDkxe2eP71h2I9OUkt1Q6EH1z1QfS90nEm";
const WHOIS_API_KEY = process.env.WHOIS_API_KEY || "582312dcb1bd4d0ab09417a6fc0dda45";

// ======================================================
// 0. LOAD FAKE URL LIST FROM FILE
// ======================================================
// Add this near the top of checker.js after imports


// URL Expansion function for checker.js
async function expandURLForChecker(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 0,
      timeout: 5000,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    if (response.status >= 300 && response.status < 400) {
      return response.headers.location;
    }

    return response.request?.res?.responseUrl || shortUrl;
  } catch (error) {
    // Fallback to original URL if expansion fails
    return shortUrl;
  }
}


function loadFakeURLs() {
  try {
    const filePath = path.join(__dirname, "fake_urls.txt");
    if (!fs.existsSync(filePath)) {
      // Create empty file if it doesn't exist
      fs.writeFileSync(filePath, "# Add suspicious URLs here\n", 'utf8');
      return [];
    }
    
    const data = fs.readFileSync(filePath, "utf8");
    return data.split("\n")
      .map(line => line.trim().toLowerCase())
      .filter(line => line && !line.startsWith("#"));
  } catch (err) {
    console.error("⚠ Could not load fake_urls.txt:", err.message);
    return [];
  }
}

// Cache the fake URLs list
let FAKE_URL_LIST = null;
function getFakeURLList() {
  if (!FAKE_URL_LIST) {
    FAKE_URL_LIST = loadFakeURLs();
  }
  return FAKE_URL_LIST;
}

function checkFakeURL(url, domain) {
  const fakeUrls = getFakeURLList();
  const lowerUrl = url.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  return fakeUrls.some(fake =>
    lowerUrl.includes(fake) || lowerDomain === fake
  );
}

// ======================================================
// 1. TYPOSQUATTING DETECTOR
// ======================================================
function detectTyposquatting(domain) {
  if (!domain) return false;
  
  const suspiciousPatterns = [
    /\d+[a-z]+/i,
    /--/,
    /(paypa1|faceb00k|amaz0n|g00gle)/i,
    /\.ru$|\.cn$|\.ml$|\.tk$|\.gq$|\.cf$|\.xyz$/i,
    /^xn--/i,
    /(secure|login|verify|update)[-]/i,
    /[-](security|verify|auth)$/i,
    /([a-z])\1{2,}/i
  ];

  const homoglyphs = /[а-яєіїѵӏοѕ]/i;
  if (homoglyphs.test(domain)) return true;

  return suspiciousPatterns.some(pattern => pattern.test(domain));
}

// ======================================================
// 2. HTTPS VALIDATION
// ======================================================
function checkHttps(url) {
  try {
    return url.startsWith("https://");
  } catch {
    return false;
  }
}

// ======================================================
// 3. IP-BASED URL CHECK
// ======================================================
function isIpBased(url) {
  return /https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(url);
}

// ======================================================
// 4. PHISHARK
// ======================================================
async function checkPhiShark(url, privateMode = false) {
  try {
    const res = await axios.post(
      PHISHARK_API_URL,
      { url, private_mode: privateMode },
      { 
        headers: { "Content-Type": "application/json" },
        timeout: 10000 // 10 second timeout
      }
    );

    return {
      source: "PhiShark",
      probability: res.data?.malicious_probability || 0,
      error: false
    };
  } catch (error) {
    console.error("PhiShark API Error:", error.message);
    return { source: "PhiShark", probability: 0, error: true };
  }
}

// ======================================================
// 5. URLERT
// ======================================================
async function checkURLert(url) {
  try {
    const scanStart = await axios.post(
      "https://api.urlert.com/v1/scans",
      { url },
      {
        headers: {
          "Authorization": `Bearer ${URLERT_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    );

    const scan_id = scanStart.data.scan_id;
    let status = "pending";
    let score = 0;
    let attempts = 0;
    const maxAttempts = 10; // Maximum 20 seconds (10 attempts * 2 seconds)

    // Polling loop with timeout
    while (status === "pending" && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
      
      const scanStatus = await axios.get(
        `https://api.urlert.com/v1/scans/${scan_id}`,
        {
          headers: {
            "Authorization": `Bearer ${URLERT_API_KEY}`
          },
          timeout: 5000
        }
      );
      status = scanStatus.data.status;
      
      if (status === "completed") {
        if (scanStatus.data.is_phishing) score = 1;
        else if (scanStatus.data.suspicious) score = 0.7;
        break;
      }
    }

    return {
      source: "URLert",
      probability: score,
      error: false
    };

  } catch (error) {
    console.error("URLert API Error:", error.message);
    return { source: "URLert", probability: null, error: true };
  }
}

// ======================================================
// 6. DOMAIN AGE (WHOIS FREAKS)
// ======================================================
async function checkDomainAge(domain) {
  if (!domain) {
    return { 
      source: "WhoisFreak", 
      domainAgeDays: null, 
      creationDate: null,
      error: true 
    };
  }

  try {
    const res = await axios.get(
      `https://api.whoisfreaks.com/v1.0/whois?apiKey=${WHOIS_API_KEY}&whois=live&domainName=${domain}&specific_sections=create_date`,
      { timeout: 5000 }
    );

    const creationDateString = res.data?.create_date || null;

    if (!creationDateString) {
      return { 
        source: "WhoisFreak", 
        domainAgeDays: null, 
        creationDate: null,
        error: false 
      };
    }

    const createdDate = new Date(creationDateString);
    if (isNaN(createdDate.getTime())) {
      return { 
        source: "WhoisFreak", 
        domainAgeDays: null, 
        creationDate: null,
        error: false 
      };
    }

    const diffDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      source: "WhoisFreak",
      domainAgeDays: diffDays,
      creationDate: creationDateString,
      error: false
    };
  } catch (error) {
    console.error("WhoisFreak API Error:", error.message);
    return { 
      source: "WhoisFreak", 
      domainAgeDays: null, 
      creationDate: null,
      error: true 
    };
  }
}

// ======================================================
// 7. DOMAIN EXTRACTOR
// ======================================================
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ======================================================
// 8. FINAL VERDICT ENGINE
// ======================================================
async function checkURL(url) {
  const domain = extractDomain(url);
  
  // Return early if domain extraction fails
  if (!domain) {
    return {
      url,
      domain: null,
      finalScore: 50, // Suspicious if domain can't be extracted
      verdict: "SUSPICIOUS",
      blacklistMatch: false,
      breakdown: ["Failed to extract domain"],
      details: {
        message: "Invalid domain format",
        typosquatting: false,
        https: checkHttps(url),
        ipBased: isIpBased(url),
        phiSharkScore: null,
        phiSharkError: true,
        urlertScore: null,
        urlertError: true,
        domainAgeDays: null,
        domainCreationDate: null,
        domainAgeError: true
      }
    };
  }

  // --- RULE 1: BLACKLIST CHECK (IMMEDIATE EXIT) ---
  const isFake = checkFakeURL(url, domain);

  if (isFake) {
    return {
      url,
      domain,
      finalScore: 100,
      verdict: "BLACKLISTED / PHISHING",
      blacklistMatch: true,
      breakdown: ["Domain found in blacklist"],
      details: {
        message: "Domain found in fake_urls.txt. Execution stopped.",
        typosquatting: false,
        https: checkHttps(url),
        ipBased: isIpBased(url),
        phiSharkScore: null,
        phiSharkError: null,
        urlertScore: null,
        urlertError: null,
        domainAgeDays: null,
        domainCreationDate: null,
        domainAgeError: null
      }
    };
  }

  // Run all checks in parallel
  const [phiResult, urlertResult, ageResult] = await Promise.allSettled([
    checkPhiShark(url),
    checkURLert(url),
    checkDomainAge(domain)
  ]);

  // Extract results
  const phiData = phiResult.status === 'fulfilled' ? phiResult.value : 
                  { source: "PhiShark", probability: 0, error: true };
  const urlertData = urlertResult.status === 'fulfilled' ? urlertResult.value : 
                     { source: "URLert", probability: null, error: true };
  const ageData = ageResult.status === 'fulfilled' ? ageResult.value : 
                  { source: "WhoisFreak", domainAgeDays: null, error: true };

  const isTyposquatting = detectTyposquatting(domain);
  const isHttps = checkHttps(url);
  const isIp = isIpBased(url);

  let totalScore = 0;
  let breakdown = [];

  // --- SCORING LOGIC ---
  if (isTyposquatting) {
    totalScore += 10;
    breakdown.push("Typosquatting Detected (+10)");
  }

  if (!isHttps) {
    totalScore += 5;
    breakdown.push("No HTTPS (+5)");
  }

  if (isIp) {
    totalScore += 5;
    breakdown.push("IP Based URL (+5)");
  }

  // PhiShark Scoring
  const phiProb = phiData.probability;
  if (phiProb > 0.90) {
    totalScore += 60;
    breakdown.push(`PhiShark > 0.90 (+60)`);
  } else if (phiProb > 0.80) {
    totalScore += 55;
    breakdown.push(`PhiShark > 0.80 (+55)`);
  } else if (phiProb > 0.50) {
    totalScore += 45;
    breakdown.push(`PhiShark > 0.50 (+45)`);
  } else if (phiProb > 0.20) {
    totalScore += 30;
    breakdown.push(`PhiShark > 0.20 (+30)`);
  }

  // Domain Age Scoring
  const age = ageData.domainAgeDays;
  if (age !== null && !ageData.error) {
    if (age < 100) {
      totalScore += 20;
      breakdown.push(`Domain Age < 100 days (+20)`);
    } else if (age < 300) {
      totalScore += 17;
      breakdown.push(`Domain Age 100-300 days (+17)`);
    }
  }

  // URLert scoring (for reference, not added to total)
  const urlertScore = urlertData.probability;
  if (urlertScore !== null && !urlertData.error) {
    breakdown.push(`URLert Score: ${urlertScore} (not counted)`);
  }

  // --- FINAL VERDICT ---
  let verdict = "SAFE";
  if (totalScore >= 80) verdict = "CRITICAL / PHISHING";
  else if (totalScore >= 50) verdict = "DANGEROUS";
  else if (totalScore >= 20) verdict = "SUSPICIOUS";

  // Clamp score between 0 and 100
  totalScore = Math.min(100, Math.max(0, totalScore));

  return {
    url,
    domain,
    finalScore: totalScore,
    verdict,
    blacklistMatch: false,
    breakdown,
    details: {
      typosquatting: isTyposquatting,
      https: isHttps,
      ipBased: isIp,
      phiSharkScore: phiData.probability,
      phiSharkError: phiData.error,
      urlertScore: urlertData.probability,
      urlertError: urlertData.error,
      domainAgeDays: ageData.domainAgeDays,
      domainCreationDate: ageData.creationDate,
      domainAgeError: ageData.error
    }
  };
}

module.exports = {
  checkURL,
  detectTyposquatting,
  checkHttps,
  isIpBased,
  checkPhiShark,
  checkURLert,
  checkDomainAge,
  extractDomain,
  expandURLForChecker
};