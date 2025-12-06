const axios = require("axios");

// -----------------------------------
// 1. PHISHARK CHECKER
// -----------------------------------
async function checkPhiShark(url, privateMode = false) {
  try {
    const res = await axios.post(
      "https://phishark.net/api/check-url",
      {
        url: url,
        private_mode: privateMode
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    return {
      source: "PhiShark",
      probability: res.data?.malicious_probability || 0,
      raw: res.data,
      error: false
    };

  } catch (err) {
    console.error("PhiShark Error:", err.message);
    return { source: "PhiShark", probability: null, error: true };
  }
}


// -----------------------------------
// 2. URLERT CHECKER
// -----------------------------------
async function checkURLert(url) {
  try {
    // STEP 1 → Submit scan request
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

    // STEP 2 → Poll status until completed
    let status = "pending";
    let result = null;

    while (status === "pending") {
      await new Promise(r => setTimeout(r, 2000)); // wait 2 sec

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

    // URLert does NOT give a direct probability → create basic score
    let score = 0;
    if (result.is_phishing) score = 1.0;
    else if (result.suspicious) score = 0.7;

    return {
      source: "URLert",
      probability: score,
      raw: result,
      error: false
    };

  } catch (err) {
    console.error("URLert Error:", err.message);
    return { source: "URLert", probability: null, error: true };
  }
}


// -----------------------------------
// 3. COMBINED VERDICT ENGINE
// -----------------------------------
async function checkURL(url) {
  const results = await Promise.all([
    checkPhiShark(url),
    checkURLert(url)
  ]);

  const phiScore = results[0].probability ?? 0;
  const urlertScore = results[1].probability ?? 0;

  const finalScore = (phiScore + urlertScore) / 2;

  let verdict = "SAFE";

  if (finalScore > 0.8) verdict = "VERY DANGEROUS";
  else if (finalScore > 0.6) verdict = "DANGEROUS";
  else if (finalScore > 0.4) verdict = "SUSPICIOUS";

  return {
    url,
    finalScore,
    verdict,
    details: results
  };
}


// -----------------------------------
// 4. RUN
// -----------------------------------
checkURL("http://mavenox.com").then(console.log);
