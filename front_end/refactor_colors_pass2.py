import os
import glob
import re

components_dir = 'src/components'

# A robust replacement strategy. 
# We look for classes like 'text-white', 'text-gray-400', 'bg-gray-800', 'border-gray-800', 'border-zinc-700', 'bg-black'
# But ONLY if they don't already have 'dark:' in front of them AND aren't already part of a responsive pair.
# Simple way: just run the regex replacement with negative lookbehind for 'dark:' and negative lookahead for ' dark:'

replacements = {
    # Backgrounds
    r'(?<!dark:)bg-black\b': 'bg-gray-50 dark:bg-black',
    r'(?<!dark:)bg-zinc-900\b': 'bg-white dark:bg-zinc-900',
    r'(?<!dark:)bg-zinc-800\b': 'bg-gray-100 dark:bg-zinc-800',
    r'(?<!dark:)bg-gray-800\b': 'bg-gray-100 dark:bg-gray-800',
    r'(?<!dark:)bg-\[\#1a1a1a\]\b': 'bg-white dark:bg-[#1a1a1a]',
    
    # Text
    r'(?<!dark:)text-white\b': 'text-gray-900 dark:text-white',
    r'(?<!dark:)text-zinc-400\b': 'text-gray-600 dark:text-zinc-400',
    r'(?<!dark:)text-zinc-300\b': 'text-gray-700 dark:text-zinc-300',
    r'(?<!dark:)text-gray-400\b': 'text-gray-600 dark:text-gray-400',
    r'(?<!dark:)text-gray-300\b': 'text-gray-700 dark:text-gray-300',
    
    # Borders
    r'(?<!dark:)border-zinc-800\b': 'border-gray-200 dark:border-zinc-800',
    r'(?<!dark:)border-zinc-700\b': 'border-gray-300 dark:border-zinc-700',
    r'(?<!dark:)border-gray-800\b': 'border-gray-200 dark:border-gray-800',
}

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    for old_regex, new_val in replacements.items():
        # Only replace if the new_val is not already right there
        # We can just run it. But wait, if 'bg-gray-50 dark:bg-black' is already there, 
        # the lookbehind for 'dark:' doesn't stop it from matching 'bg-black' in 'dark:bg-black', actually lookbehind DOES stop it.
        # But what about 'text-gray-900 dark:text-white'? The lookbehind `(?<!dark:)text-white` fails because it's preceded by 'dark:'.
        # BUT what if we have `bg-gray-50 dark:bg-zinc-900`? Lookbehind handles that. 
        # What if we have `bg-white text-gray-900 dark:text-white`? It works.
        content = re.sub(old_regex, new_val, content)

    # Some manual fixes that might have gotten duplicated like `bg-gray-50 dark:bg-gray-50 dark:bg-black`
    # Let's clean up any double responsive classes.
    content = content.replace('bg-white dark:bg-white dark:bg-zinc-900', 'bg-white dark:bg-zinc-900')
    content = content.replace('bg-gray-50 dark:bg-gray-50 dark:bg-black', 'bg-gray-50 dark:bg-black')
    content = content.replace('text-gray-900 dark:text-gray-900 dark:text-white', 'text-gray-900 dark:text-white')
    content = content.replace('bg-gray-100 dark:bg-gray-100 dark:bg-gray-800', 'bg-gray-100 dark:bg-gray-800')
    content = content.replace('bg-gray-100 dark:bg-gray-100 dark:bg-zinc-800', 'bg-gray-100 dark:bg-zinc-800')
    content = content.replace('border-gray-200 dark:border-gray-200 dark:border-gray-800', 'border-gray-200 dark:border-gray-800')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for filepath in glob.glob(os.path.join(components_dir, '**', '*.tsx'), recursive=True):
    if 'Settings.tsx' not in filepath and 'card.tsx' not in filepath:
        replace_in_file(filepath)

print("Pass 2 Refactoring complete.")
