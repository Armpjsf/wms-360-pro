const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

/**
 * Console-based script to regenerate Google OAuth2 Tokens
 * Usage: node scripts/auth-console.js
 */

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');
const GMAIL_TOKEN_PATH = path.join(__dirname, '../gmail_token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets', 
  'https://www.googleapis.com/auth/drive'
];

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('Error: credentials.json not found in root directory.');
    process.exit(1);
  }

  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('--- Google Authentication (Console Mode) ---');
  console.log('1. Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Log in and grant permissions.');
  console.log('3. You will be redirected to a page (e.g., localhost).');
  console.log('4. Copy the "code" parameter from the URL bar.');
  console.log('   (It looks like: 4/0AfrIe...)');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n✅ Success! Exchanged code for tokens.');
      
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      fs.writeFileSync(GMAIL_TOKEN_PATH, JSON.stringify(tokens, null, 2));
      
      console.log('Tokens saved to:');
      console.log(' - ' + TOKEN_PATH);
      console.log(' - ' + GMAIL_TOKEN_PATH);
      console.log('\nNow try "เริ่มสแกน" (Start Scan) again in the app.');
    } catch (err) {
      console.error('\n❌ Authentication failed:', err.message);
    }
  });
}

main();
