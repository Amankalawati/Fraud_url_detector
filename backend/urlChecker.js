const axios = require("axios");

// -----------------------------------
// 0. TYPOSQUATTING DETECTOR
// -----------------------------------
function detectTyposquatting(domain) {
  const suspiciousPatterns = [
    /\d+[a-z]+/i,                          // letters + numbers
    /--/,                                  // double hyphen
    /(paypa1|faceb00k|amaz0n|g00gle)/i,    // fake lookalikes
    /\.ru$|\.cn$|\.ml$|\.tk$|\.gq$|\.cf$|\.xyz$/i,  
    /^xn--/i,                              // punycode
    /(secure|login|verify|update)[-]/i,
    /[-](security|verify|auth)$/i,
    /([a-z])\1{2,}/i                       // repeated letters
  ];

  const homoglyphs = /[а-яєіїѵӏοѕ]/i;

  if (homoglyphs.test(domain)) return true;

  return suspiciousPatterns.some(pattern => pattern.test(domain));
}



// -----------------------------------
// STEP 4: HTTPS VALIDATION
// -----------------------------------
function checkHttps(url) {
  try {
    return url.startsWith("https://");
  } catch {
    return false;
  }
}



// -----------------------------------
// STEP 5: IP-BASED URL DETECTOR
// -----------------------------------
function isIpBased(url) {
  return /https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(url);
}



// -----------------------------------
// 1. PHISHARK CHECKER
// -----------------------------------
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
      raw: res.data,
      error: false
    };

  } catch {
    return { source: "PhiShark", probability: null, error: true };
  }
}



// -----------------------------------
// 2. URLERT CHECKER
// -----------------------------------
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
    let result = null;

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
      result = scanStatus.data;
    }

    let score = 0;
    if (result.is_phishing) score = 1;
    else if (result.suspicious) score = 0.7;

    return {
      source: "URLert",
      probability: score,
      raw: result,
      error: false
    };

  } catch {
    return { source: "URLert", probability: null, error: true };
  }
}



// -----------------------------------
// 3. WHOISFREAK PARSER
// -----------------------------------
async function checkDomainAge(domain) {
  try {
    const res = await axios.get(
      `https://api.whoisfreaks.com/v1.0/whois?apiKey=582312dcb1bd4d0ab09417a6fc0dda45&whois=live&domainName=${domain}`
    );

    const data = res.data;

    const creationDateString = data?.create_date || null;

    if (!creationDateString) {
      return {
        source: "WhoisFreak",
        domainAgeDays: null,
        creationDate: null,
        raw: data,
        error: false
      };
    }

    const createdDate = new Date(creationDateString);

    if (isNaN(createdDate.getTime())) {
      return {
        source: "WhoisFreak",
        domainAgeDays: null,
        creationDate: null,
        raw: data,
        error: false
      };
    }

    const diffDays = Math.floor(
      (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      source: "WhoisFreak",
      domainAgeDays: diffDays,
      creationDate: createdDate,
      raw: data,
      error: false
    };

  } catch {
    return { source: "WhoisFreak", domainAgeDays: null, error: true };
  }
}



// -----------------------------------
// DOMAIN EXTRACTOR
// -----------------------------------
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}



// -----------------------------------
// FINAL VERDICT ENGINE (updated)
// -----------------------------------
async function checkURL(url) {
  const domain = extractDomain(url);

  const results = await Promise.all([
    checkPhiShark(url),
    checkURLert(url),
    checkDomainAge(domain)
  ]);

  const phiScore = results[0].probability ?? 0;
  const urlertScore = results[1].probability ?? 0;

  // ------------ Domain Age Scoring ------------
  let domainAgeScore = 0;
  const age = results[2].domainAgeDays;

  if (age !== null) {
    if (age < 90) domainAgeScore = 0.8;
    else if (age < 250) domainAgeScore = 0.4;
  }

  // ------------ Typosquatting Score ------------
  const typoDetected = detectTyposquatting(domain);
  const typoScore = typoDetected ? 0.7 : 0;

  // ------------ HTTPS Score ------------
  const httpsOK = checkHttps(url);
  const httpsScore = httpsOK ? 0 : 0.6; // HTTP = risky

  // ------------ IP URL Score ------------
  const ipBased = isIpBased(url);
  const ipScore = ipBased ? 1 : 0; // IP URLs = Very suspicious



  // -----------------------------------
  // FINAL SCORE (Weights Updated)
  // -----------------------------------
  const finalScore =
    (phiScore * 0.35) +
    (urlertScore * 0.35) +
    (domainAgeScore * 0.10) +
    (typoScore * 0.10) +
    (httpsScore * 0.05) +
    (ipScore * 0.05);


  let verdict = "SAFE";
  if (finalScore > 0.85) verdict = "VERY DANGEROUS";
  else if (finalScore > 0.60) verdict = "DANGEROUS";
  else if (finalScore > 0.40) verdict = "SUSPICIOUS";

  return {
    url,
    domain,
    finalScore: Number(finalScore.toFixed(2)),
    verdict,
    typosquatting: typoDetected,
    https: httpsOK,
    ipBased,
    details: {
      phiShark: results[0],
      urlert: results[1],
      domain: results[2]
    }
  };
}



// -----------------------------------
// TEST
// -----------------------------------
checkURL("https://www.brandbasecapsule.com").then(console.log);
