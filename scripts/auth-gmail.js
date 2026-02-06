const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const destroyer = require('server-destroy');

/**
 * Script to regenerate Gmail OAuth2 Tokens
 * Usage: node scripts/auth-gmail.js
 */

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');
const GMAIL_TOKEN_PATH = path.join(__dirname, '../gmail_token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets', 
  'https://www.googleapis.com/auth/drive'
];
const REDIRECT_URI = 'http://localhost';
const PORT = 80;

async function main() {
  // 1. Load Credentials
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('Error: credentials.json not found in root directory.');
    process.exit(1);
  }

  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id } = credentials.installed || credentials.web;

  // 2. Create OAuth2 Client
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
  );

  // 3. Authenticate
  try {
    const token = await authenticate(oAuth2Client);
    
    // 4. Save Token
    console.log('Authentication successful! Saving tokens...');
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    fs.writeFileSync(GMAIL_TOKEN_PATH, JSON.stringify(token, null, 2)); 
    
    console.log(`Token saved to: ${TOKEN_PATH}`);
    console.log(`Token saved to: ${GMAIL_TOKEN_PATH}`);
    console.log('✅ Done. You can now use the Email Scan feature.');
    process.exit(0);
  } catch (e) {
    console.error('Authentication failed:', e);
    if (e.code === 'EACCES') {
        console.error('\n⚠️  Error: Permission denied binding to port 80.');
        console.error('Please run this script as Administrator (Windows) or sudo (Mac/Linux).');
        console.error('Or add "http://localhost:3000/oauth2callback" to your Google Cloud Console Redirect URIs.');
    }
    process.exit(1);
  }
}

/**
 * Authenticate with Google
 */
function authenticate(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        // Handle root path / since redirect URI is http://localhost
        if (req.url.indexOf('code=') > -1) {
          const qs = new url.URL(req.url, REDIRECT_URI).searchParams;
          const code = qs.get('code');
          res.end('Authentication successful! You can close this tab.');
          server.destroy();
          const { tokens } = await oAuth2Client.getToken(code);
          resolve(tokens);
        } else {
            // Check if user hit page without code
            res.end('Waiting for authentication...');
        }
      } catch (e) {
        reject(e);
      }
    });

    server.listen(PORT, async () => {
      // Dynamic import for ESM-only package
      try {
        const openModule = await import('open');
        const open = openModule.default;
        
        const authorizeUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            prompt: 'consent' // Force refresh token generation
        });
        console.log(`Opening browser for authentication on ${REDIRECT_URI}...`);
        console.log(`(If this fails, you may need to run as Admin to use port 80)`);
        open(authorizeUrl);
      } catch (err) {
        console.error("Failed to open browser automatically.");
      }
    });
    
    server.on('error', (e) => reject(e));
    destroyer(server);
  });
}

main();
