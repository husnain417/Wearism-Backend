from db.supabase_client import get_supabase
db = get_supabase()
res = db.table('ai_results').select('*').order('created_at', desc=True).limit(5).execute()
import json
print(json.dumps(res.data, indent=2))
