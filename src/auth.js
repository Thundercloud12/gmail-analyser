import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import open from 'open';

// File paths
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'tokens.json');

// Required scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];


export async function authenticate(){
  const credentials = await loadCredentials();
  
  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const tokens = await loadTokens();
    oAuth2Client.setCredentials(tokens);
    
    const isValid = await checkTokenValidity(oAuth2Client);
    
    if (isValid) {
      console.log('✅ Using existing authentication');
      return oAuth2Client;
    } else {
      console.log('⚠️  Token expired, refreshing...');
      await refreshAccessToken(oAuth2Client);
      return oAuth2Client;
    }
  } catch (error) {
    console.log('🔐 No valid tokens found. Starting authorization...');
    return await authorizeNewUser(oAuth2Client);
  }
}

async function loadCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `credentials.json not found. Download it from Google Cloud Console.\n` +
      `Place it in: ${CREDENTIALS_PATH}`
    );
  }
}

async function loadTokens(){
  const content = await fs.readFile(TOKEN_PATH, 'utf-8');
  return JSON.parse(content);
}

async function saveTokens(tokens){
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('💾 Tokens saved to:', TOKEN_PATH);
}

async function checkTokenValidity(client){
  try {
    const tokenInfo = await client.getAccessToken();
    return tokenInfo.token !== null;
  } catch (error) {
    return false;
  }
}

async function refreshAccessToken(client) {
  try {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await saveTokens(credentials);
    console.log('✅ Access token refreshed');
  } catch (error) {
    throw new Error('Failed to refresh token. Need to re-authorize.');
  }
}

async function authorizeNewUser(client){
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🌐 Opening browser for authorization...');
  console.log('If browser doesn\'t open, visit this URL:\n');
  console.log(authUrl);
  console.log('');

  await open(authUrl);

  const code = await getAuthCodeFromCallback();

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  
  await saveTokens(tokens);

  console.log('✅ Authorization successful!\n');
  return client;
}

function getAuthCodeFromCallback(){
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:3000`);
        
        // Handle any path with code parameter
        const code = url.searchParams.get('code');
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          
          server.close();
          resolve(code);
        } else if (url.searchParams.get('error')) {
          throw new Error(`Authorization error: ${url.searchParams.get('error')}`);
        }
      } catch (error) {
        res.writeHead(500);
        res.end('Error during authorization');
        server.close();
        reject(error);
      }
    });

    server.listen(3000, () => {
      console.log('🔄 Waiting for authorization on http://localhost:3000/...');
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 120000);
  });
}

