const fs = require('fs');
const readline = require('readline');

async function main() {
  const logPath = 'C:\\Users\\adetw\\.gemini\\antigravity-ide\\brain\\dde3bf04-c776-4592-a9d9-0f0a39183ee2\\.system_generated\\logs\\transcript.jsonl';
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    const match = line.match(/sbp_[a-zA-Z0-9]+/g);
    if (match) {
      console.log(`Line ${lineCount}: Found tokens:`, match);
      console.log(line.slice(0, 500));
      console.log("-----------------------------------------");
    }
  }
  console.log("Finished searching.");
}

main();
