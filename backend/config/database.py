from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database as PyMongoDatabase
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: MongoClient
    db: PyMongoDatabase

def get_database():
    return Database.db

def connect_to_mongo():
    try:
        Database.client = MongoClient(settings.mongo_url)
        Database.db = Database.client.get_database(name=settings.mongo_db_name)
        
        # Create indexes
        Database.db.users.create_index([("email", ASCENDING)], unique=True)
        Database.db.themes.create_index([("code", ASCENDING)], unique=True)
        Database.db.questions.create_index([("theme_id", ASCENDING)])
        Database.db.questions.create_index([("created_at", DESCENDING)])
        Database.db.attempts.create_index([("user_id", ASCENDING)])
        Database.db.attempts.create_index([("exam_id", ASCENDING)])
        Database.db.practical_sets.create_index([("created_at", DESCENDING)])
        Database.db.practical_sets.create_index([("is_active", ASCENDING)])
        Database.db.analytics_failures.create_index([("user_id", ASCENDING)])
        Database.db.analytics_failures.create_index([("theme_id", ASCENDING)])
        Database.db.analytics_failures.create_index([("failed_at", DESCENDING)])
        Database.db.user_theme_stats.create_index([("user_id", ASCENDING), ("theme_id", ASCENDING)], unique=True)
        
        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
        raise

def close_mongo_connection():
    if Database.client:
        Database.client.close()
        logger.info("Closed MongoDB connection")