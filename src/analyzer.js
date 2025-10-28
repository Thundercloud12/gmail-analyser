import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';
import fetch from 'node-fetch';

const OLLAMA_HOST = 'http://localhost:11434';
const MODEL_NAME = 'gemma3'; 

// Rule-based spam patterns
const SPAM_RULES = {
  senders: [
    'noreply@',
    'no-reply@',
    'donotreply@',
    'notification@',
    'alert@',
  ],
  subjects: [
    'verify your account',
    'confirm your identity',
    'update payment method',
    'claim your prize',
    'urgent action required',
    'suspicious activity',
    'reset password',
    'click here now',
  ],
  keywords: [
    'nigerian prince',
    'wire transfer',
    'bitcoin',
    'cryptocurrency',
    'congratulations you won',
    'tax refund',
  ],
};

function isRuleBasedSpam(from, subject, snippet) {
  const lowerFrom = from.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();

  // Check sender patterns
  for (const pattern of SPAM_RULES.senders) {
    if (lowerFrom.includes(pattern)) {
      return true;
    }
  }

  // Check subject patterns
  for (const pattern of SPAM_RULES.subjects) {
    if (lowerSubject.includes(pattern)) {
      return true;
    }
  }

  // Check keyword patterns in subject and snippet
  for (const keyword of SPAM_RULES.keywords) {
    if (lowerSubject.includes(keyword) || lowerSnippet.includes(keyword)) {
      return true;
    }
  }

  return false;
}



async function isOllamaRunning(){
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { method: 'GET', timeout: 2000 });
    return res.ok;
  } catch {
    return false;
  }
}

function startOllamaServer(){
  return new Promise((resolve, reject) => {
    const process = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    setTimeout(resolve, 4000); // Give it a few seconds; adjust for model load
  });
}

async function waitForOllamaReady(maxWaitMs = 12000){
  const interval = 1000;
  let waited = 0;
  while (waited < maxWaitMs) {
    if (await isOllamaRunning()) return;
    await new Promise(res => setTimeout(res, interval));
    waited += interval;
  }
  throw new Error('Ollama did not start within expected time');
}

async function callOllama(emailData){

  if (!(await isOllamaRunning())) {
    console.log('🟡 Ollama not running. Starting server...');
    await startOllamaServer();
    await waitForOllamaReady();
    console.log('🟢 Ollama is now running.');
  } else {
    console.log('🟢 Ollama already running.');
  }


  const prompt = `
    Given the following email:
    From: ${emailData.from}
    Subject: ${emailData.subject}
    Content: ${emailData.content}
    You must analyze and return ONLY a valid JSON in this format:
    {
    "isSpam": true/false,
    "summary": "...",
    "sender": "...",
    "subject": "...",
    "confidence": number (0-100),
    "timestamp": "${new Date().toISOString()}"
    }
    Respond with nothing but valid JSON.`;

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream:false
    })
  });

  if (!response.ok) throw new Error('Ollama API call failed');

  const data = await response.json(); 
  let parsed;
  try {
    parsed = JSON.parse(data.response);
  } catch (err) {
    const match = data.response.match(/\{[\s\S]*?\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  }
  if (!parsed) throw new Error('Failed to parse Ollama JSON output');

  return parsed;
}

export async function callSmartAnalyzer(emailData) {
  try {
    return await callOllama(emailData);
  } catch (error) {
    console.error('❌ Ollama Analyzer error:', error.message);
    return {
      isSpam: false,
      summary: 'Ollama analysis failed, treating as legitimate',
      sender: emailData.from,
      subject: emailData.subject,
      error: error.message,
    };
  }
}

export async function analyzeEmails(fetchedEmails) {
  if (!fetchedEmails || fetchedEmails.length === 0) {
    console.log('⚠️  No emails to analyze');
    return [];
  }

  console.log(`\n🔍 Analyzing ${fetchedEmails.length} emails...\n`);

  const results = [];
  let ruleBasedCount = 0;
  let aiCount = 0;

  for (const email of fetchedEmails) {
    // --- Stage 1: Fast rule-based check
    if (isRuleBasedSpam(email.from, email.subject, email.snippet)) {
      results.push({
        id: email.id,
        isSpam: true,
        method: 'rule-based',
        summary: `Flagged as spam: matched rule`,
        sender: email.from,
        subject: email.subject,
        timestamp: new Date().toISOString(),
      });
      ruleBasedCount++;
      console.log(`✅ [RULE] ${email.from} - ${email.subject}`);
      continue; // Don't pass to AI
    }

    // --- Stage 2: AI-based detection
    const analysis = await callSmartAnalyzer({
      from: email.from,
      subject: email.subject,
      content: email.snippet,
    });

    results.push({
      id: email.id,
      ...analysis,
      method: 'ai-based',
    });
    aiCount++;

    const statusIcon = analysis.isSpam ? '⚠️ ' : '✅';
    console.log(`${statusIcon}[AI] ${email.from} - ${email.subject}`);
  }

  console.log(`\n📊 Analysis Summary:`);
  console.log(`   Rule-based detections: ${ruleBasedCount}`);
  console.log(`   AI detections: ${aiCount}`);
  console.log(`   Total spam flagged: ${results.filter(r => r.isSpam).length}\n`);

  // --- Save results
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const outputPath = path.join(process.cwd(), `analysis-${timestamp}.json`);
  
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${outputPath}`);

  return results;
}
