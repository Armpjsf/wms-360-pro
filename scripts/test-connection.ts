
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// HARDCODED IDs from your project
const SPREADSHEET_ID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM"; 
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

async function testConnection() {
  console.log('🔍 Testing Google Sheets Connection...');

  try {
    const keyPath = path.join(process.cwd(), 'service-key.json');
    if (!fs.existsSync(keyPath)) {
      throw new Error(`❌ service-key.json NOT FOUND at ${keyPath}`);
    }
    console.log('✅ Found service-key.json');

    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log(`📡 Connecting to Sheet ID: ${SPREADSHEET_ID}...`);

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'properties.title,sheets.properties.title',
    });

    console.log('🎉 CONNECTION SUCCESSFUL!');
    console.log(`📄 Spreadsheet Title: ${response.data.properties?.title}`);
    console.log('📋 Available Sheets (Tabs):');
    response.data.sheets?.forEach(s => {
      console.log(`   - "${s.properties?.title}" (ID: ${s.properties?.sheetId})`);
    });

    // Try reading the Inventory sheet's data to check columns
    console.log(`\n👀 Peeking at "📊 รายงานสินค้าคงเหลือ" headers and first row...`);
    const invRows = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'📊 รายงานสินค้าคงเหลือ'!A1:Z2`
    });
    console.log('INVENTORY SAMPLE:', JSON.stringify(invRows.data.values, null, 2));

    /*
    console.log(`\n👀 Peeking at "💰 Transaction จ่าย" headers...`);
    const txRows = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'💰 Transaction จ่าย'!A1:Z2`
    });
    console.log('TX SAMPLE:', JSON.stringify(txRows.data.values, null, 2));
    */

  } catch (error: any) {
    console.error('\n❌ CONNECTION FAILED:');
    if (error.code === 403 || error.code === 404) {
        console.error('👉 Cause: Permission Denied or File Not Found.');
        console.error('👉 Solution: Share the Google Sheet with the client_email in service-key.json');
    } else if (error.code === 400 && error.message.includes('Invalid grant')) {
        console.error('👉 Cause: Invalid Credentials (Invalid Grant).');
        console.error('👉 Solution: The service-key.json might be expired, revoked, or is a User Client ID instead of Service Account.');
    } else {
        console.error(error.message);
    }
  }
}

testConnection();
