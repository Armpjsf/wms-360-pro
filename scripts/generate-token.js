const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const open = require('open'); // You might need to install this: npm install open
const destroyer = require('server-destroy'); // You might need: npm install server-destroy

/**
 * To use this script:
 * 1. Ensure you have 'credentials.json' in your root or parent directory (from Google Cloud Console).
 * 2. Run: node scripts/generate-token.js
 * 3. Follow the browser prompt to log in.
 * 4. The script will save a new 'token.json' with full Drive permissions.
 */

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

async function authenticate() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('Error: credentials.json not found! Please download it from Google Cloud Console.');
    return;
  }

  const keys = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const key = keys.installed || keys.web;
  
  // Parse Redirect URI to determine port
  const redirectUri = key.redirect_uris[0] || 'http://localhost:3000/oauth2callback';
  const redirectUrlObj = new url.URL(redirectUri);
  const port = parseInt(redirectUrlObj.port) || 80;

  const oauth2Client = new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    redirectUri
  );

  return new Promise((resolve, reject) => {
    // Generate the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Open an http server to accept the oauth callback.
    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.startsWith(redirectUrlObj.pathname)) {
            const qs = new url.URL(req.url, 'http://localhost').searchParams;
            res.end('Authentication successful! You can close this window.');
            server.destroy();
            
            const { tokens } = await oauth2Client.getToken(qs.get('code'));
            oauth2Client.setCredentials(tokens);
            
            // Save the token to disk
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
            console.log('Token stored to', TOKEN_PATH);
            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(port, () => {
        console.log(`Listening on port ${port}...`);
        // open the browser to the authorize url to start the workflow
        const opener = open.default || open;
        opener(authorizeUrl, { wait: false }).then(cp => cp.unref());
      });
    destroyer(server);
  });
}

authenticate().catch(console.error);
