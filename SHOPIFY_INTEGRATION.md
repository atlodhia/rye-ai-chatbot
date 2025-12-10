# Shopify Integration for MOTD Health News

To display the daily health & wellness news on your Shopify page, you have a few options:

## Option 1: JavaScript Fetch (Easiest)

Add this JavaScript code to your Shopify page's Liquid template. This will fetch the news from your Next.js API and display it.

### Step 1: Deploy Your Next.js API

First, make sure your Next.js API is publicly accessible:
- Deploy to Vercel, Netlify, or your hosting provider
- Or use a service like ngrok for testing: `ngrok http 3000`

### Step 2: Add to Your Shopify Liquid Template

Add this code to your Shopify page template where you want the MOTD to appear:

```liquid
<div id="motd-container" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
  <div id="motd-loading">Loading today's health story...</div>
</div>

<script>
(async function() {
  const container = document.getElementById('motd-container');
  const loading = document.getElementById('motd-loading');
  
  try {
    // Replace with your deployed API URL
    const apiUrl = 'https://your-nextjs-app.vercel.app/api/motd';
    // For local testing: 'http://localhost:3000/api/motd' (won't work in production)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add CORS headers if needed
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch MOTD');
    }
    
    const data = await response.json();
    
    // Display the content
    container.innerHTML = `
      <h2 style="font-size: 1.5em; margin-bottom: 10px;">${data.dayGreeting}</h2>
      <h3 style="font-size: 1.2em; margin-bottom: 10px; color: #333;">${data.title}</h3>
      <p style="line-height: 1.6; color: #666; margin-bottom: 15px;">${data.summary}</p>
      ${data.sourceName && data.sourceUrl ? `
        <p style="font-size: 0.9em; color: #888;">
          Source: <a href="${data.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #0066cc;">${data.sourceName}</a>
        </p>
      ` : ''}
    `;
  } catch (error) {
    console.error('Error loading MOTD:', error);
    container.innerHTML = `
      <p style="color: #999;">Unable to load today's health story. Please try again later.</p>
    `;
  }
})();
</script>
```

## Option 2: Shopify App Proxy (More Secure)

If you want to use Shopify's App Proxy feature, you'll need to:

1. Set up an app proxy in your Shopify admin
2. Configure your Next.js API to handle Shopify proxy requests
3. Use Liquid to call the proxy endpoint

This is more complex but provides better integration.

## Option 3: Server-Side Rendering with Liquid

If you want to fetch the news server-side in Liquid, you'll need to:
1. Create a Shopify app or use Shopify Functions
2. Store the daily news in Shopify metafields
3. Update metafields via a scheduled job

This is the most complex but most performant option.

## Quick Start (Option 1)

For the fastest setup:

1. **Deploy your Next.js app** (or use ngrok for testing):
   ```bash
   # Using ngrok for local testing
   ngrok http 3000
   # Copy the https URL (e.g., https://abc123.ngrok.io)
   ```

2. **Add CORS headers to your API** (if needed for cross-origin requests)

3. **Add the JavaScript code above** to your Shopify page template

4. **Replace the API URL** in the script with your deployed URL

Let me know which option you prefer and I can help you implement it!
