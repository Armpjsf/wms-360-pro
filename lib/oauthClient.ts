
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Paths to check for tokens/credentials
const TOKEN_PATHS = [
    path.join(process.cwd(), 'token.json'),
    path.join(process.cwd(), 'gmail_token.json'),
    path.join(process.cwd(), '..', 'token.json'),
    path.join(process.cwd(), '..', 'gmail_token.json')
];

const CRED_PATHS = [
    path.join(process.cwd(), 'credentials.json'),
    path.join(process.cwd(), '..', 'client_secret.json'),
    path.join(process.cwd(), '..', 'credentials.json')
];

function findFirst(paths: string[]) {
    return paths.find(p => fs.existsSync(p));
}

// SHARED AUTHENTICATED CLIENT
export function getOAuth2Client() {
    const tokenPath = findFirst(TOKEN_PATHS);
    const credPath = findFirst(CRED_PATHS);

    if (tokenPath && credPath) {
        try {
            const content = fs.readFileSync(credPath, 'utf-8');
            const credentials = JSON.parse(content);
            const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
            
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            
            const token = fs.readFileSync(tokenPath, 'utf-8');
            oAuth2Client.setCredentials(JSON.parse(token));
            
            return oAuth2Client;
        } catch (error) {
            console.error("Auth client init failed:", error);
        }
    }
    return null;
}
