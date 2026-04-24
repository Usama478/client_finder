const fs = require('fs');
const path = require('path');

const dir = 'src/app/pages/app';

const mappings = [
  { regex: /"#0f1218"/g, replacement: '"var(--card)"' },
  { regex: /"#0a0c10"/g, replacement: '"var(--background)"' },
  { regex: /"#151a22"/g, replacement: '"var(--muted)"' },
  { regex: /"#1c2230"/g, replacement: '"var(--accent)"' },
  { regex: /"#e8edf5"/g, replacement: '"var(--foreground)"' },
  { regex: /"#8a95a8"/g, replacement: '"var(--muted-foreground)"' },
  { regex: /"#5a6478"/g, replacement: '"var(--muted-foreground)"' },
  { regex: /"#3b82f6"/g, replacement: '"var(--primary)"' },
  { regex: /"#ef4444"/g, replacement: '"var(--destructive)"' },
  { regex: /"#10b981"/g, replacement: '"var(--chart-2)"' },
  { regex: /"#f59e0b"/g, replacement: '"var(--chart-3)"' },
  { regex: /"rgba\(255,255,255,0\.0[0-9]\)"/g, replacement: '"var(--border)"' },
  { regex: /"rgba\(255,255,255,0\.1\)"/g, replacement: '"var(--border)"' },
  { regex: /rgba\(255,255,255,0\.0[0-9]\)/g, replacement: 'var(--border)' },
  { regex: /rgba\(255,255,255,0\.1\)/g, replacement: 'var(--border)' },
  { regex: /rgba\(59,130,246,0\.0[0-9]\)/g, replacement: 'var(--primary)' }, // We'll just tweak those manually if needed
];

// Let's replace the fixed hover/background tokens in classNames if needed as well, 
// for instance: hover:bg-[#1c2230] => hover:bg-accent
const classMappings = [
  { regex: /hover:bg-\[#1c2230\]/g, replacement: 'hover:bg-accent' },
  { regex: /text-\[#5a6478\]/g, replacement: 'text-muted-foreground' },
  { regex: /text-\[#e8edf5\]/g, replacement: 'text-foreground' },
  { regex: /text-\[#8a95a8\]/g, replacement: 'text-muted-foreground' },
];

function processDir(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      for (const map of mappings) {
        content = content.replace(map.regex, map.replacement);
      }
      for (const map of classMappings) {
        content = content.replace(map.regex, map.replacement);
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(dir);
console.log('Done!');
