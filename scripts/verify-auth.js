const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * Script to verify the validity of current tokens
 * Usage: node scripts/verify-auth.js
 */

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');

async function main() {
  console.log('--- Verifying Google Token Validity ---');

  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('❌ Error: token.json not found!');
    return;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(token);

  try {
    // 1. Test Gmail
    console.log('Testing Gmail API...');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail OK: Connected as ' + profile.data.emailAddress);

    // 2. Test Drive
    console.log('Testing Drive API...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const driveRes = await drive.files.list({ pageSize: 1 });
    console.log('✅ Drive OK: Successfully listed files.');

    // 3. Test Sheets
    console.log('Testing Sheets API...');
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const sheetRes = await sheets.spreadsheets.get({ 
        spreadsheetId: '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM', // Your product sheet
        fields: 'properties.title'
    });
    console.log('✅ Sheets OK: Accessed "' + sheetRes.data.properties.title + '"');

    console.log('\n✨ ALL SYSTEMS GREEN! The tokens in token.json are valid.');
    console.log('If the web app still fails, try restarting the Next.js dev server.');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED!');
    console.error('Error:', error.message);
    if (error.message.includes('invalid_grant')) {
        console.error('👉 The token is still invalid. You may need to run auth-console.js again carefully.');
    }
  }
}

main();
