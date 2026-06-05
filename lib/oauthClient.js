"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuth2Client = getOAuth2Client;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const TOKEN_PATH = path_1.default.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path_1.default.join(process.cwd(), 'credentials.json');
// Paths to check for tokens/credentials
const TOKEN_PATHS = [
    path_1.default.join(process.cwd(), 'token.json'),
    path_1.default.join(process.cwd(), 'gmail_token.json'),
    path_1.default.join(process.cwd(), '..', 'token.json'),
    path_1.default.join(process.cwd(), '..', 'gmail_token.json')
];
const CRED_PATHS = [
    path_1.default.join(process.cwd(), 'credentials.json'),
    path_1.default.join(process.cwd(), '..', 'client_secret.json'),
    path_1.default.join(process.cwd(), '..', 'credentials.json')
];
function findFirst(paths) {
    return paths.find(p => fs_1.default.existsSync(p));
}
// SHARED AUTHENTICATED CLIENT
function getOAuth2Client() {
    const tokenPath = findFirst(TOKEN_PATHS);
    const credPath = findFirst(CRED_PATHS);
    if (tokenPath && credPath) {
        try {
            const content = fs_1.default.readFileSync(credPath, 'utf-8');
            const credentials = JSON.parse(content);
            const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
            const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            const token = fs_1.default.readFileSync(tokenPath, 'utf-8');
            oAuth2Client.setCredentials(JSON.parse(token));
            return oAuth2Client;
        }
        catch (error) {
            console.error("Auth client init failed:", error);
        }
    }
    return null;
}
