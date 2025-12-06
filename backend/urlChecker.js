const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ======================================================
// 0. LOAD FAKE URL LIST FROM FILE
// ======================================================
function loadFakeURLs() {
  try {
    const filePath = path.join(__dirname, "utils", "fake_urls.txt");
    const data = fs.readFileSync(filePath, "utf8");
    return data.split("\n").map(line => line.trim().toLowerCase()).filter(Boolean);
  } catch (err) {
    console.log("⚠ Could not load fake_urls.txt:", err.message);
    return [];
  }
}

const FAKE_URL_LIST = loadFakeURLs();

function checkFakeURL(url, domain) {
  const lowerUrl = url.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  return FAKE_URL_LIST.some(fake =>
    lowerUrl.includes(fake) || lowerDomain === fake
  );
}

// ======================================================
// 1. TYPOSQUATTING DETECTOR
// ======================================================
function detectTyposquatting(domain) {
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
      "https://phishark.net/api/check-url",
      { url, private_mode: privateMode },
      { headers: { "Content-Type": "application/json" } }
    );

    return {
      source: "PhiShark",
      probability: res.data?.malicious_probability || 0,
      // Only store probability score, not entire response
      error: false
    };
  } catch {
    return { source: "PhiShark", probability: 0, error: true };
  }
}

// ======================================================
// 5. URLERT (Result kept, but ignored in scoring)
// ======================================================
async function checkURLert(url) {
  try {
    const scanStart = await axios.post(
      "https://api.urlert.com/v1/scans",
      { url },
      {
        headers: {
          "Authorization": "Bearer sk_ptOa4LXnxETrntMqJ0PZ9iR6jgLYUaMDkxe2eP71h2I9OUkt1Q6EH1z1QfS90nEm",
          "Content-Type": "application/json"
        }
      }
    );

    const scan_id = scanStart.data.scan_id;
    let status = "pending";
    let score = 0;

    // Polling loop
    while (status === "pending") {
      await new Promise(r => setTimeout(r, 2000));
      const scanStatus = await axios.get(
        `https://api.urlert.com/v1/scans/${scan_id}`,
        {
          headers: {
            "Authorization": "Bearer sk_ptOa4LXnxETrntMqJ0PZ9iR6jgLYUaMDkxe2eP71h2I9OUkt1Q6EH1z1QfS90nEm"
          }
        }
      );
      status = scanStatus.data.status;
      
      if (status === "completed") {
        if (scanStatus.data.is_phishing) score = 1;
        else if (scanStatus.data.suspicious) score = 0.7;
      }
    }

    return {
      source: "URLert",
      probability: score,
      error: false
    };

  } catch {
    return { source: "URLert", probability: null, error: true };
  }
}

// ======================================================
// 6. DOMAIN AGE (WHOIS FREAKS) - OPTIMIZED VERSION
// ======================================================
async function checkDomainAge(domain) {
  try {
    // Optimized: Only request the create_date field
    const res = await axios.get(
      `https://api.whoisfreaks.com/v1.0/whois?apiKey=582312dcb1bd4d0ab09417a6fc0dda45&whois=live&domainName=${domain}&specific_sections=create_date`,
      { timeout: 5000 } // 5 second timeout
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
      creationDate: creationDateString, // Store only the date string
      error: false
    };
  } catch (err) {
    // Silently fail - don't console.log in production
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
  let totalScore = 0;
  let breakdown = [];

  // --- RULE 1: BLACKLIST CHECK (IMMEDIATE EXIT) ---
  const isFake = checkFakeURL(url, domain);

  if (isFake) {
    return {
      url,
      domain,
      finalScore: 100,
      verdict: "BLACKLISTED / PHISHING",
      blacklistMatch: true,
      details: {
        message: "Domain found in fake_urls.txt. Execution stopped.",
      }
    };
  }

  // --- OPTIMIZATION: Run checks in parallel ---
  const results = await Promise.allSettled([
    checkPhiShark(url),
    checkURLert(url),
    checkDomainAge(domain)
  ]);

  // Extract results
  const phiResult = results[0].status === 'fulfilled' ? results[0].value : 
                    { source: "PhiShark", probability: 0, error: true };
  const urlertResult = results[1].status === 'fulfilled' ? results[1].value : 
                       { source: "URLert", probability: null, error: true };
  const ageResult = results[2].status === 'fulfilled' ? results[2].value : 
                    { source: "WhoisFreak", domainAgeDays: null, error: true };

  const isTyposquatting = detectTyposquatting(domain);
  const isHttps = checkHttps(url);
  const isIp = isIpBased(url);

  // --- RULE 2: CUMULATIVE SCORING ---

  // i) Typosquatting (+10)
  if (isTyposquatting) {
    totalScore += 10;
    breakdown.push("Typosquatting Detected (+10)");
  }

  // ii) HTTPS Validation False (+5)
  if (!isHttps) {
    totalScore += 5;
    breakdown.push("No HTTPS (+5)");
  }

  // iii) IP Based (+5)
  if (isIp) {
    totalScore += 5;
    breakdown.push("IP Based URL (+5)");
  }

  // iv) PhiShark Scoring
  const phiProb = phiResult.probability;

  if (phiProb > 0.90) {
    totalScore += 60;
    breakdown.push(`PhiShark > 0.90 (+60)`);
  } else if (phiProb > 0.80) {
    totalScore += 55;
    breakdown.push(`PhiShark > 0.80 (+55)`);
  } else if (phiProb > 0.50 && phiProb < 0.80) {
    totalScore += 45;
    breakdown.push(`PhiShark 0.50-0.80 (+45)`);
  } else if (phiProb > 0.20 && phiProb < 0.50) {
    totalScore += 30;
    breakdown.push(`PhiShark 0.20-0.50 (+30)`);
  }

  // v) Domain Age Scoring
  const age = ageResult.domainAgeDays;
  if (age !== null && !ageResult.error) {
    if (age < 100) {
      totalScore += 20;
      breakdown.push(`Domain Age < 100 days (+20)`);
    } else if (age >= 100 && age < 300) {
      totalScore += 17;
      breakdown.push(`Domain Age 100-300 days (+17)`);
    }
  }

  // --- FINAL VERDICT ---
  let verdict = "SAFE";
  if (totalScore >= 80) verdict = "CRITICAL / PHISHING";
  else if (totalScore >= 50) verdict = "DANGEROUS";
  else if (totalScore >= 20) verdict = "SUSPICIOUS";

  // Clean, minimal output without large API responses
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
      // Only include essential info, not entire API responses
      phiSharkScore: phiResult.probability,
      phiSharkError: phiResult.error,
      urlertScore: urlertResult.probability,
      urlertError: urlertResult.error,
      domainAgeDays: ageResult.domainAgeDays,
      domainCreationDate: ageResult.creationDate,
      domainAgeError: ageResult.error
    }
  };
}

// ======================================================
// 9. TEST
// ======================================================
checkURL("https://mavenox.com/").then(result => {
  console.log(JSON.stringify(result, null, 2));
});