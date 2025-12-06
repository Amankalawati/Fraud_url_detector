const express = require('express');
const router = express.Router();
const { checkURL } = require('../utils/checker');

// Input validation middleware
const validateURL = (req, res, next) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({
      error: true,
      message: 'URL is required'
    });
  }
  
  // Basic URL validation
  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('http')) {
      return res.status(400).json({
        error: true,
        message: 'URL must start with http:// or https://'
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: true,
      message: 'Invalid URL format'
    });
  }
  
  next();
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'URL Security Checker API'
  });
});

// Main URL checking endpoint
router.post('/check', validateURL, async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log(`🔍 Checking URL: ${url}`);
    
    // Add optional timeout (default: 30 seconds)
    const timeout = req.body.timeout || 30000;
    
    // Create a promise with timeout
    const checkPromise = checkURL(url);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });
    
    // Race between check and timeout
    const result = await Promise.race([checkPromise, timeoutPromise]);
    
    // Calculate response time
    const responseTime = Date.now() - req.startTime;
    
    res.json({
      ...result,
      metadata: {
        checkedAt: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        apiVersion: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking URL:', error.message);
    
    if (error.message === 'Request timeout') {
      return res.status(408).json({
        error: true,
        message: 'URL check timed out. Try again later.',
        url: req.body.url
      });
    }
    
    res.status(500).json({
      error: true,
      message: 'Failed to check URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      url: req.body.url
    });
  }
});

// Batch URL checking endpoint
router.post('/check/batch', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'URLs array is required and must not be empty'
      });
    }
    
    if (urls.length > 10) {
      return res.status(400).json({
        error: true,
        message: 'Maximum 10 URLs allowed per batch'
      });
    }
    
    console.log(`🔍 Checking ${urls.length} URLs in batch`);
    
    // Process URLs in parallel with limit
    const results = await Promise.allSettled(
      urls.map(url => checkURL(url))
    );
    
    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          success: true,
          data: result.value
        };
      } else {
        return {
          success: false,
          url: urls[index],
          error: result.reason.message
        };
      }
    });
    
    res.json({
      batchId: `batch_${Date.now()}`,
      total: urls.length,
      successful: formattedResults.filter(r => r.success).length,
      failed: formattedResults.filter(r => !r.success).length,
      results: formattedResults,
      metadata: {
        checkedAt: new Date().toISOString(),
        apiVersion: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in batch check:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to process batch request'
    });
  }
});

// Request timing middleware
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

module.exports = router;