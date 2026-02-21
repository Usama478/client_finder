import os
import re

files = [
    r"c:\Users\Dell\Desktop\project\client_finder_project\front_end\src\App.tsx",
    r"c:\Users\Dell\Desktop\project\client_finder_project\front_end\src\components\Clients.tsx",
    r"c:\Users\Dell\Desktop\project\client_finder_project\front_end\src\components\SearchBusinesses.tsx",
    r"c:\Users\Dell\Desktop\project\client_finder_project\front_end\src\components\ClientDetails.tsx"
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Safely replace type definition in App.tsx
    content = re.sub(r'type Business = \{[^}]+\};', 
'''type Business = {
  place_id: string;
  business_name: string;
  address: string;
  phone_number?: string | null;
  rating: number | null;
  category: string;
  website: string;
  relevance_score?: number;
  verification_status?: \\'pending\\' | \\'processing\\' | \\'verified\\';
};''', content, count=1)

    # 1. Replace property access .id to .place_id for business/current objects
    content = re.sub(r'\bbusiness\.id\b', 'business.place_id', content)
    content = re.sub(r'\bbusinesses\.id\b', 'businesses.place_id', content)
    content = re.sub(r'\bcurrent\.id\b', 'current.place_id', content)
    content = re.sub(r'\bb\.id\b', 'b.place_id', content)
    content = re.sub(r'\bcurrentBusiness\.id\b', 'currentBusiness.place_id', content)

    # 2. Replace .name to .business_name for business/current objects
    content = re.sub(r'\bbusiness\.name\b', 'business.business_name', content)
    content = re.sub(r'\bcurrent\.name\b', 'current.business_name', content)
    content = re.sub(r'\bb\.name\b', 'b.business_name', content)
    content = re.sub(r'\bcurrentBusiness\.name\b', 'currentBusiness.business_name', content)

    # 3. Handle object creation mapping in normalizeBusiness (App.tsx)
    # We'll just replace the return object explicitly later or let it be. Actually, let's fix normalizeBusiness manually.
    
    # 4. Replace other occurrences for relevance score and verification status
    content = re.sub(r'\brelevancyScore\b', 'relevance_score', content)
    content = re.sub(r'\bverificationStatus\b', 'verification_status', content)
    
    # For Clients.tsx & ClientDetails.tsx - replacing client.name -> client.business_name, client.id -> client.place_id
    content = re.sub(r'\bclient\.id\b', 'client.place_id', content)
    content = re.sub(r'\bclient\.name\b', 'client.business_name', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done refactoring fields.")
