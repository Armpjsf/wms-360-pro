
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'gmail_token.json');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

async function getNewToken() {
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
        console.log('IMPORTANT: Please delete any old "token.json" file if it exists to ensure this new "gmail_token.json" is used.');
    } catch (err) { 
        console.error('Error retrieving access token', err); 
    }
  });
}

getNewToken();
