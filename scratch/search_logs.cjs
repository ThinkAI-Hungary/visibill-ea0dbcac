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
    if (lineCount >= 5736 && lineCount <= 5800) {
      const obj = JSON.parse(line);
      console.log(`Line ${lineCount} - Index ${obj.step_index}: ${obj.type} (${obj.source})`);
      if (obj.tool_calls) {
        console.log("  Tool Calls:", JSON.stringify(obj.tool_calls));
      }
      if (obj.content && obj.type === 'USER_INPUT') {
        console.log("  User Input:", obj.content);
      }
      console.log("-----------------------------------------");
    }
  }
}

main();
