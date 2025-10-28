import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function loadLatestAnalysis() {
  try {
    // Find the latest analysis file
    const files = await fs.readdir(process.cwd());
    const analysisFiles = files.filter(f => f.startsWith('analysis-') && f.endsWith('.json'));
    
    if (analysisFiles.length === 0) {
      console.log('❌ No analysis files found');
      return null;
    }
    
    // Get the most recent file
    const latest = analysisFiles.sort().reverse()[0];
    const content = await fs.readFile(path.join(process.cwd(), latest), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error loading analysis:', error.message);
    return null;
  }
}

function displayEmails(emails) {
  console.log('\n' + '='.repeat(80));
  console.log('📧 EMAIL LIST');
  console.log('='.repeat(80) + '\n');
  
  emails.forEach((email, index) => {
    const status = email.isSpam ? '🚨 SPAM' : '✅ LEGIT';
    const method = email.method === 'rule-based' ? '[RULE]' : '[AI]';
    
    console.log(`[${index}] ${status} ${method}`);
    console.log(`    From: ${email.sender}`);
    console.log(`    Subject: ${email.subject}`);
    console.log(`    Confidence: ${email.confidence || 'N/A'}%`);
    console.log('');
  });
  
  console.log('='.repeat(80));
}

function displayFullEmail(email) {
  console.log('\n' + '='.repeat(80));
  console.log('📧 FULL EMAIL DETAILS');
  console.log('='.repeat(80) + '\n');
  
  console.log(`Status: ${email.isSpam ? '🚨 SPAM' : '✅ LEGITIMATE'}`);
  console.log(`Method: ${email.method === 'rule-based' ? 'Rule-Based Detection' : 'AI Analysis'}`);
  console.log(`From: ${email.sender}`);
  console.log(`Subject: ${email.subject}`);
  console.log(`Date: ${email.timestamp}`);
  console.log(`Confidence: ${email.confidence || 'N/A'}%`);
  console.log(`\nSummary:\n${email.summary}`);
  console.log('\n' + '='.repeat(80) + '\n');
}

function displayStats(emails) {
  const spam = emails.filter(e => e.isSpam).length;
  const legit = emails.length - spam;
  const ruleBasedCount = emails.filter(e => e.method === 'rule-based').length;
  const aiCount = emails.filter(e => e.method === 'ai-based').length;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 ANALYSIS STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total Emails: ${emails.length}`);
  console.log(`Spam Detected: ${spam}`);
  console.log(`Legitimate: ${legit}`);
  console.log(`Rule-Based Detections: ${ruleBasedCount}`);
  console.log(`AI Detections: ${aiCount}`);
  console.log('='.repeat(80) + '\n');
}

async function main() {
  console.log('\n🔍 Gmail Analyzer - Review Terminal\n');
  
  const emails = await loadLatestAnalysis();
  
  if (!emails || emails.length === 0) {
    console.log('❌ No emails to review');
    rl.close();
    return;
  }

  displayStats(emails);
  displayEmails(emails);

  let running = true;
  
  while (running) {
    const input = await prompt(
      '\n📋 Commands:\n' +
      '  [0-N]   - Show full details of email N\n' +
      '  list    - Show email list\n' +
      '  stats   - Show statistics\n' +
      '  spam    - Show only spam emails\n' +
      '  legit   - Show only legitimate emails\n' +
      '  exit    - Exit\n\n' +
      'Enter command: '
    );

    const cmd = input.trim().toLowerCase();

    if (cmd === 'exit') {
      running = false;
      console.log('👋 Goodbye!\n');
    } else if (cmd === 'list') {
      displayEmails(emails);
    } else if (cmd === 'stats') {
      displayStats(emails);
    } else if (cmd === 'spam') {
      const spamEmails = emails.filter(e => e.isSpam);
      console.log(`\n🚨 Found ${spamEmails.length} spam emails:\n`);
      displayEmails(spamEmails);
    } else if (cmd === 'legit') {
      const legitEmails = emails.filter(e => !e.isSpam);
      console.log(`\n✅ Found ${legitEmails.length} legitimate emails:\n`);
      displayEmails(legitEmails);
    } else if (/^\d+$/.test(cmd)) {
      const index = parseInt(cmd);
      if (index >= 0 && index < emails.length) {
        displayFullEmail(emails[index]);
      } else {
        console.log(`❌ Invalid email index. Choose 0-${emails.length - 1}`);
      }
    } else {
      console.log('❌ Unknown command. Try again.');
    }
  }

  rl.close();
}

main();