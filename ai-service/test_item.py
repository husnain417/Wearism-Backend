from db.supabase_client import get_supabase
db = get_supabase()
res = db.table('wardrobe_items').select('*').eq('id', '0734e742-0e72-41ad-aef7-3486cff52a64').single().execute()
import json
print(json.dumps(res.data, indent=2))
