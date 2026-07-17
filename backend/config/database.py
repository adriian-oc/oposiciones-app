from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient
    db: AsyncIOMotorDatabase

def get_database():
    return Database.db

async def connect_to_mongo():
    try:
        Database.client = AsyncIOMotorClient(settings.mongo_url)
        Database.db = Database.client.get_database(name=settings.mongo_db_name)

        # Create indexes
        await Database.db.users.create_index([("email", ASCENDING)], unique=True)
        await Database.db.users.create_index([("firebase_uid", ASCENDING)], unique=True)
        await Database.db.themes.create_index([("code", ASCENDING)], unique=True)
        await Database.db.questions.create_index([("theme_id", ASCENDING)])
        await Database.db.questions.create_index([("created_at", DESCENDING)])
        await Database.db.attempts.create_index([("user_id", ASCENDING)])
        await Database.db.attempts.create_index([("exam_id", ASCENDING)])
        await Database.db.practical_sets.create_index([("created_at", DESCENDING)])
        await Database.db.practical_sets.create_index([("is_active", ASCENDING)])
        await Database.db.analytics_failures.create_index([("user_id", ASCENDING)])
        await Database.db.analytics_failures.create_index([("theme_id", ASCENDING)])
        await Database.db.analytics_failures.create_index([("failed_at", DESCENDING)])
        await Database.db.user_theme_stats.create_index([("user_id", ASCENDING), ("theme_id", ASCENDING)], unique=True)
        await Database.db.content_units.create_index([("area_id", ASCENDING), ("theme_id", ASCENDING)])
        await Database.db.questions.create_index([("content_area", ASCENDING)])
        await Database.db.messages.create_index([("student_id", ASCENDING), ("created_at", ASCENDING)])
        await Database.db.users.create_index([("assigned_profesor_id", ASCENDING)])
        await Database.db.progress.create_index([("user_id", ASCENDING)], unique=True)
        await Database.db.attempts.create_index([("content_unit_key", ASCENDING)])
        await Database.db.access_requests.create_index([("status", ASCENDING)])
        await Database.db.access_requests.create_index([("created_at", DESCENDING)])
        await Database.db.study_preferences.create_index([("user_id", ASCENDING)], unique=True)
        await Database.db.study_calendar.create_index([("user_id", ASCENDING), ("date", ASCENDING)])
        await Database.db.study_calendar.create_index([("id", ASCENDING)], unique=True)

        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
        raise

def close_mongo_connection():
    if Database.client:
        Database.client.close()
        logger.info("Closed MongoDB connection")
