import fetch from "node-fetch";

async function expandURL(shortUrl) {
  try {
    const response = await fetch(shortUrl, {
      method: "GET",
      redirect: "follow"
    });

    console.log("Original URL:", response.url);
    return response.url;

  } catch (error) {
    console.error("Error expanding URL:", error);
    return null;
  }
}

// Example:
expandURL("https://tinyurl.com/mwabu3ky");
