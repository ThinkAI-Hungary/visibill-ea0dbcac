const fs = require('fs');
const content = fs.readFileSync('src/pages/Accounty/ClientDetailsPage.tsx', 'utf8');

// Let's print out lines 880 to 920 with their braces context
const lines = content.split('\n');
for (let i = 875; i < 915; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
