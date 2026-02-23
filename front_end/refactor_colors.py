import os
import glob

components_dir = 'src/components'

replacements = {
    'bg-black': 'bg-gray-50 dark:bg-black',
    'bg-zinc-900': 'bg-white dark:bg-zinc-900',
    'bg-zinc-800': 'bg-gray-100 dark:bg-zinc-800',
    'text-white': 'text-gray-900 dark:text-white',
    'text-zinc-400': 'text-gray-500 dark:text-zinc-400',
    'border-zinc-800': 'border-gray-200 dark:border-zinc-800'
}

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # We must be careful not to replace something that was already replaced.
    # To avoid double replacement (e.g. if we run this twice), we check if the 
    # replacement string is already there. Better yet, we just split by tokens if possible,
    # but simple string replace works if we ensure we aren't doing it twice.
    # Actually, we can just strictly match the old tokens using regex or word boundaries.
    import re
    
    for old, new in replacements.items():
        # Negative lookbehind and lookahead to ensure we don't double-replace
        # i.e., replace 'bg-black' only if it's not preceded by 'dark:' and not followed by something that indicates it's already part of the new string
        # Actually, simpler: if the file already has 'dark:bg-black', we can temporarily hide it, then do the replacements.
        # But since we're only running this once, re.sub with word boundaries is safe enough.
        
        # Word boundaries for tailwind classes are space, quote, or backtick
        pattern = r'(?<!dark:)\b' + re.escape(old) + r'\b'
        content = re.sub(pattern, new, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

# Process all .tsx files in src/components and subdirectories
for filepath in glob.glob(os.path.join(components_dir, '**', '*.tsx'), recursive=True):
    # Exclude Settings.tsx because it was hand-coded with dark mode already
    if 'Settings.tsx' not in filepath:
        replace_in_file(filepath)

print("Refactoring complete.")
