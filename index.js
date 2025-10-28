import { authenticate } from './src/auth.js';
import { google } from 'googleapis';
import { fetchRecentEmails } from './src/gmail.js';
import { analyzeEmails } from './src/analyzer.js';
import { sendNotification } from './src/notifier.js';
import dns from 'dns';

function checkInternetConnection() {
  return new Promise((resolve) => {
    dns.resolve('www.google.com', (err) => {
      if (err) {
        console.log('❌ No internet connection');
        resolve(false);
      } else {
        console.log('✅ Connected');
        resolve(true);
      }
    });
  });
}

async function waitForConnection(maxWaitMs = 60000) {
  const startTime = Date.now();
  const checkInterval = 5000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const hasConnection = await checkInternetConnection();
    
    if (hasConnection) {
      console.log('✅ Connection re-established!');
      return true;
    }
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏳ No connection. Retrying in 5 seconds... (${elapsed}s elapsed)`);
    
    await new Promise(res => setTimeout(res, checkInterval));
  }
  
  return false;
}

async function main() {
  try {
    // Check internet connection first
    const hasInternet = await checkInternetConnection();
    
    if (!hasInternet) {
      console.log('⏳ Waiting for connection (max 60 seconds)...');
      
      const reconnected = await waitForConnection(60000);
      
      if (!reconnected) {
        console.log('❌ Connection not restored within 60 seconds. Exiting...');
        process.exit(1);
      }
    }
    
    const auth = await authenticate();
    
    const gmail = google.gmail({ version: 'v1', auth });
    
    const recentEmails = await fetchRecentEmails(gmail);
    
    const analysisResults = await analyzeEmails(recentEmails);
    console.log('✅ Analysis complete. Processed', analysisResults.length, 'emails');
    
    // Send desktop notification and open terminal
    await sendNotification(analysisResults);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();