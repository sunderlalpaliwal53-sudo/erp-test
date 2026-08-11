"""MongoDB connection and shared instances."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'stanvard_erp')

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

# Collections
schools_col = db['schools']
users_col = db['users']
students_col = db['students']
classes_col = db['classes']
fee_heads_col = db['fee_heads']
fee_plans_col = db['fee_plans']
fee_assignments_col = db['fee_assignments']
payments_col = db['payments']
receipts_col = db['receipts']
razorpay_orders_col = db['razorpay_orders']
attendance_col = db['attendance']
homework_col = db['homework']
timetable_col = db['timetable']
events_col = db['events']
circulars_col = db['circulars']
gallery_col = db['gallery']
staff_col = db['staff']
notifications_col = db['notifications']
audit_col = db['audit_logs']
settings_col = db['settings']
counters_col = db['counters']
discount_approvals_col = db['discount_approvals']
exams_col = db['exams']
marks_col = db['marks']


async def get_next_sequence(name: str) -> int:
    """Atomic sequence generator for receipt numbers, admission numbers etc."""
    doc = await counters_col.find_one_and_update(
        {'_id': name},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=True,
    )
    return doc['seq'] if doc else 1
