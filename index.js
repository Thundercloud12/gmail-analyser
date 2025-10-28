const { authenticate } = require('./src/auth.js');
const { google } = require('googleapis');
const { fetchRecentEmails } = require('./src/gmail.js');
const { analyzeEmails } = require('./src/analyzer.js');

async function main() {
  try {
    const auth = await authenticate();
    
    const gmail = google.gmail({ version: 'v1', auth });
    
    const recentEmails = await fetchRecentEmails(gmail);
    
    
    const analysisResults = await analyzeEmails(recentEmails);
    console.log('✅ Analysis complete. Processed', analysisResults.length, 'emails');
    
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();