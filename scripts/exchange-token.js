const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// INPUT FROM USER
const AUTH_CODE = "4/0ASc3gC3EEp1l6cAJ_6H6QCHI2OPRCtMhOxX9k3j-mfPxtg_Il0-BzL00kdedMxZXilhwTQ";

const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

async function main() {
  console.log('--- Exchanging Code for Token ---');
  
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ Error: credentials.json not found at ${CREDENTIALS_PATH}`);
    return;
  }

  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  try {
    const { tokens } = await oAuth2Client.getToken(AUTH_CODE);
    oAuth2Client.setCredentials(tokens);
    
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log(`\n✅ Token stored to ${TOKEN_PATH}`);
    console.log('Success! The application should now work.');
  } catch (err) {
    console.error('\n❌ Error retrieving access token:', err.message);
    if (err.message.includes('invalid_grant')) {
        console.log('NOTE: The code might have expired. Please run "node scripts/generate-token.js" to get a fresh code.');
    }
  }
}

main().catch(console.error);
