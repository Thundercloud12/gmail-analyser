import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function sendNotification(analysisResults) {
  const spamCount = analysisResults.filter(r => r.isSpam).length;
  const totalCount = analysisResults.length;
  
  const title = '📧 Gmail Analysis Complete';
  const message = `${spamCount} spam detected out of ${totalCount} emails.`;
  
  try {
    await execAsync(`notify-send "${title}" "${message}" --urgency=normal --expire-time=30000`);
    
    console.log('\n📬 Desktop notification sent!');
    console.log('Opening review terminal...\n');
    
    await new Promise(res => setTimeout(res, 1000));
    
    const cwd = process.cwd();
    await execAsync(`gnome-terminal -- bash -c "cd '${cwd}' && node src/cli.js; exec bash"`);
    
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    console.log('💡 Make sure libnotify-bin is installed: sudo apt install libnotify-bin');
  }
}