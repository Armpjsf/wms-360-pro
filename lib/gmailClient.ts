import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

// Legacy path to token.json
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const GMAIL_TOKEN_PATH = path.join(process.cwd(), 'gmail_token.json'); // Specific for Gmail
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Fallback to parent directory (Root Project Folder)
const PARENT_TOKEN_PATH = path.join(process.cwd(), '..', 'token.json');
const PARENT_GMAIL_TOKEN_PATH = path.join(process.cwd(), '..', 'gmail_token.json');

const PARENT_CREDENTIALS_PATH = path.join(process.cwd(), '..', 'client_secret.json'); 
const PARENT_CREDENTIALS_PATH_ALT = path.join(process.cwd(), '..', 'credentials.json'); 

// function: getGmailClient
export async function getGmailClient() {
  
  // 1. Try simple OAuth2 with local token (Legacy Migration Support) - PREFERRED for User Gmail
  // Legacy apps use 'token.json' with 'gmail.modify' scope.
  // 1. Try simple OAuth2 with local token (Legacy Migration Support) - PREFERRED for User Gmail
  // Legacy apps use 'token.json' with 'gmail.modify' scope.
  let tokenPath = "";
  let credPath = "";

  // Helper to find first existing file
  const findFirst = (paths: string[]) => paths.find(p => fs.existsSync(p));

  // ONLY look in Current Dir or Parent Dir. Do not look in legacy code folder.
  tokenPath = findFirst([
      GMAIL_TOKEN_PATH, 
      TOKEN_PATH, 
      PARENT_GMAIL_TOKEN_PATH, 
      PARENT_TOKEN_PATH
  ]) || "";

  credPath = findFirst([
      CREDENTIALS_PATH,
      PARENT_CREDENTIALS_PATH,
      PARENT_CREDENTIALS_PATH_ALT
  ]) || "";

  // 0. PRIORITY: Environment Variable (Serverless/Vercel Support)
  // This bypasses filesystem issues entirely.
  const envCredentials = process.env.GOOGLE_CREDENTIALS_JSON;
  const envToken = process.env.GMAIL_TOKEN_JSON;

  if (envToken && (credPath || envCredentials)) {
      try {
          console.log("Using GMAIL_TOKEN_JSON from Environment Variables");
          
          let credentials;
          if (envCredentials) {
              credentials = JSON.parse(envCredentials);
          } else {
              const content = fs.readFileSync(credPath, 'utf-8');
              credentials = JSON.parse(content);
          }

          const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
          
          const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
          const token = JSON.parse(envToken);
          oAuth2Client.setCredentials(token);
          
          return google.gmail({ version: 'v1', auth: oAuth2Client });
      } catch (error) {
          console.error("Env Var token auth failed:", error);
      }
  }

  if (tokenPath && credPath) {
     try {
         const content = fs.readFileSync(credPath, 'utf-8');
         const credentials = JSON.parse(content);
         const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
         
         const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
         
         const token = fs.readFileSync(tokenPath, 'utf-8');
         oAuth2Client.setCredentials(JSON.parse(token));
         
         // Auto-renew: Listen for token updates and save them back to file
         oAuth2Client.on('tokens', (tokens) => {
            try {
                if (tokens.refresh_token) {
                    // If new refresh token, save everything
                    console.log("Saving new Refresh Token...");
                    const current = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
                    const newTokens = { ...current, ...tokens };
                    fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2));
                } else {
                    // If only access token, update it
                    console.log("Saving new Access Token...");
                    const current = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
                    const newTokens = { ...current, access_token: tokens.access_token, expiry_date: tokens.expiry_date };
                    fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2));
                }
            } catch (err) {
                console.warn("Could not save refreshed token (Likely Read-Only Env/Vercel):", err);
            }
         });

         console.log(`Using Legacy Token: ${path.basename(tokenPath)}`);
         return google.gmail({ version: 'v1', auth: oAuth2Client });
     } catch (error) {
         console.error("Legacy token auth failed:", error);
         // Fallthrough to SA
     }
  }

  // 2. Try Service Account (Fallback)
  // Warning: SA needs Domain-Wide Delegation to access user emails ('me').
  try {
     const auth = new GoogleAuth({
       // Changed from readonly to modify to match Legacy capabilities
       scopes: ['https://www.googleapis.com/auth/gmail.modify'],
     });
     
     // Only if credentials exist
     if (process.env.GOOGLE_APPLICATION_CREDENTIALS || fs.existsSync('service-key.json') || fs.existsSync('service_account.json')) {
         const client = await auth.getClient();
         console.log("Using Service Account for Gmail Client");
         return google.gmail({ version: 'v1', auth: client as any });
     }
  } catch (e) {
     console.log("Service Account Gmail init failed:", e);
  }

  return null;
}
