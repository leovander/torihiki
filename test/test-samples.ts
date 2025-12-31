import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseGoingEmail } from '../src/lib/going-parser';

// Auto-discover all JSON files in test folder
const testDir = 'test';
const samples = readdirSync(testDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => join(testDir, f));

console.log(`Found ${samples.length} test files\n`);

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const file of samples) {
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const subject = data.subject || '(no subject)';
  const deal = parseGoingEmail(data.htmlBody);

  const filename = file.split('/').pop();

  if (deal && deal.flightPrice && deal.travelDates) {
    passed++;
    console.log(`✓ ${filename}`);
    console.log(`  Subject: ${subject}`);
    console.log(
      `  Parsed: ${deal.destination} | ${deal.flightPrice} | ${deal.travelDates}`,
    );
    if (deal.airports.length > 0) {
      console.log(`  Airports: ${deal.airports.map((a) => a.code).join(', ')}`);
    }
    console.log();
  } else {
    failed++;
    failures.push(filename || file);
    console.log(`✗ ${filename}`);
    console.log(`  Subject: ${subject}`);
    if (deal) {
      console.log(
        `  Partial parse - Destination: ${deal.destination || 'MISSING'}`,
      );
      console.log(
        `  Price: ${deal.flightPrice || 'MISSING'}, Dates: ${deal.travelDates || 'MISSING'}`,
      );
    } else {
      console.log(`  Failed to parse destination`);

      // Debug: show what patterns might match
      const html = data.htmlBody;
      const normalized = html.replace(/\s+/g, ' ');

      // Check for h1 patterns
      const h1Patterns = [
        {
          name: 'tinyMce',
          pattern:
            /<h1[^>]*>.*?<span[^>]*tinyMce-placeholder[^>]*>([^<]+)<\/span>/i,
        },
        {
          name: 'h1-class',
          pattern:
            /<h1[^>]*class="h1-(?:short|long)"[^>]*>\s*(?:<!--.*?-->\s*)?([^<]+)<\/h1>/i,
        },
      ];

      for (const { name, pattern } of h1Patterns) {
        const match = normalized.match(pattern);
        if (match) {
          console.log(`  Debug: ${name} pattern matched: "${match[1].trim()}"`);
        }
      }

      // Show h1 context
      const h1Idx = normalized.indexOf('<h1');
      if (h1Idx > -1) {
        console.log(`  Debug h1: ${normalized.substring(h1Idx, h1Idx + 200)}`);
      }
    }
    console.log();
  }
}

console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`Failed files: ${failures.join(', ')}`);
}
