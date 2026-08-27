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
    const obj = JSON.parse(line);
    // Search for migration run tools
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'run_command' && (tc.args.CommandLine.includes('sql') || tc.args.CommandLine.includes('db') || tc.args.CommandLine.includes('migration') || tc.args.CommandLine.includes('psql') || tc.args.CommandLine.includes('node') || tc.args.CommandLine.includes('python'))) {
          console.log(`Line ${lineCount} - Index ${obj.step_index}: run_command: ${tc.args.CommandLine}`);
          console.log("-----------------------------------------");
        }
      }
    }
    if (obj.type === 'RUN_COMMAND' && obj.content && (obj.content.includes('sql') || obj.content.includes('migration') || obj.content.includes('psql'))) {
      console.log(`Line ${lineCount} - Index ${obj.step_index}: RUN_COMMAND output containing sql/migration/psql`);
      console.log("-----------------------------------------");
    }
  }
  console.log("Finished searching.");
}

main();
