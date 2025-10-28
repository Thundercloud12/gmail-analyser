const fs = require('fs/promises');
const path = require('path');

const STATE_PATH = path.join(process.cwd(), 'gmail-state.json');

async function loadLastRun() {
  try {
    const content = await fs.readFile(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // First run: initialize with current time
    const initialState = { timestamp: Date.now() };
    await fs.writeFile(STATE_PATH, JSON.stringify(initialState, null, 2));
    console.log('📝 First run detected. Initializing state file...');
    return initialState;
  }
}

async function saveLastRun(state) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2));
  console.log('💾 State saved');
}

async function listNewEmailIds(gmail, lastTimestamp) {
  const afterDate = new Date(lastTimestamp);
  const queryDate = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;

  console.log('📅 Querying emails after:', queryDate);

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${queryDate} label:inbox -label:spam -label:trash`,
  });

  const messages = res.data.messages || [];
  console.log(`📧 Found ${messages.length} new emails`);
  return messages.map(msg => msg.id);
}


async function fetchEmailDetails(gmail, ids) {
  const emails = [];

  await Promise.all(
    ids.map(async (id) => {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const payload = res.data.payload;
      const headers = (payload?.headers || []).reduce(
        (acc, h) => ({ ...acc, [h.name]: h.value }),
        {}
      );

      emails.push({
        id,
        threadId: res.data.threadId,
        date: headers['Date'] || '',
        from: headers['From'] || '',
        subject: headers['Subject'] || '',
        snippet: res.data.snippet || '',
      });
    })
  );

  return emails;
}

async function fetchRecentEmails(gmail) {
  const state = await loadLastRun();
  const lastTimestamp = state.timestamp || Date.now();

  const newIds = await listNewEmailIds(gmail, lastTimestamp);

  if (newIds.length === 0) {
    console.log('✅ No new emails since last run.');
    return [];
  }

  const emails = await fetchEmailDetails(gmail, newIds);

  const maxDate = Math.max(
    ...emails
      .map(e => new Date(e.date).getTime())
      .filter(n => !isNaN(n))
  );

  if (maxDate > lastTimestamp) {
    await saveLastRun({ timestamp: maxDate });
  }

  return emails;
}

module.exports = { fetchRecentEmails };