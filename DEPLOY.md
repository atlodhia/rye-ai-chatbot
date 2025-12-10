# Deploy to Vercel

## Quick Deploy

1. **Login to Vercel** (if not already):
   ```bash
   vercel login
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? **No** (for first time)
   - Project name: (press enter for default or choose a name)
   - Directory: **./** (press enter)
   - Override settings? **No** (press enter)

3. **Set Environment Variables** (if needed):
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add any required env vars from `.env.example`

4. **Get your deployment URL**:
   - After deployment, Vercel will show you the URL
   - It will be something like: `https://your-project-name.vercel.app`

5. **Update Shopify snippet**:
   - Replace the API URL in your Shopify Liquid snippet with:
   - `https://your-project-name.vercel.app/api/motd`

## Production Deploy

For production:
```bash
vercel --prod
```

## Update Shopify Snippet

Once deployed, update `shopify-motd-cors-fix.liquid`:
- Change `API_URL` from ngrok URL to your Vercel URL
- Example: `const API_URL = 'https://your-app.vercel.app/api/motd';`
