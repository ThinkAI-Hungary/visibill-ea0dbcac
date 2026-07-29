import fs from 'fs';

const envPath = './.env.local';
const envStr = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envStr.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim().replace(/^VITE_/, '');
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1').replace(/\r/g, '');
      envVars[key] = val;
    }
  }
});

console.log('Parsed envVars keys:', Object.keys(envVars));
console.log('SUPABASE_URL:', envVars.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY length:', envVars.SUPABASE_SERVICE_KEY ? envVars.SUPABASE_SERVICE_KEY.length : 0);
