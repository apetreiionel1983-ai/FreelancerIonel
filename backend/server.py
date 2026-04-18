from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import base64
import io
import uuid
import shutil
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutSessionRequest

# PDF/EPUB processing
try:
    import PyPDF2
    from ebooklib import epub
    from bs4 import BeautifulSoup
    PDF_EPUB_ENABLED = True
except ImportError:
    PDF_EPUB_ENABLED = False

# AI Translation
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    AI_TRANSLATION_ENABLED = True
except ImportError:
    AI_TRANSLATION_ENABLED = False

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# Create the main app
app = FastAPI(title="FreelancerIonel API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth")
books_router = APIRouter(prefix="/books")
admin_router = APIRouter(prefix="/admin")
payment_router = APIRouter(prefix="/payments")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== CONSTANTS ====================

LANGUAGES = {
    "ro": {"name": "Română", "flag": "🇷🇴"},
    "en": {"name": "English", "flag": "🇬🇧"},
    "es": {"name": "Español", "flag": "🇪🇸"},
    "de": {"name": "Deutsch", "flag": "🇩🇪"},
    "it": {"name": "Italiano", "flag": "🇮🇹"},
    "fr": {"name": "Français", "flag": "🇫🇷"}
}

CATEGORIES = {
    "fiction": {"ro": "Ficțiune", "en": "Fiction", "es": "Ficción", "de": "Fiktion", "it": "Narrativa", "fr": "Fiction"},
    "novella": {"ro": "Nuvele", "en": "Novellas", "es": "Novelas cortas", "de": "Novellen", "it": "Novelle", "fr": "Nouvelles"},
    "poetry": {"ro": "Poezii", "en": "Poetry", "es": "Poesía", "de": "Poesie", "it": "Poesia", "fr": "Poésie"}
}

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BookCreate(BaseModel):
    title: str
    description: str
    language: str
    category: str
    price: float = 0.0
    is_free: bool = True
    cover_url: Optional[str] = None

class BookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_free: Optional[bool] = None
    is_published: Optional[bool] = None

class PurchaseCreate(BaseModel):
    book_id: str
    origin_url: str

# ==================== PASSWORD UTILS ====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ==================== JWT UTILS ====================

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except:
        return None

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ROUTES ====================

@auth_router.post("/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "purchased_books": [],
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Track for giveaway
    await db.giveaway_entries.insert_one({
        "user_id": user_id,
        "email": email,
        "name": user_data.name,
        "purchase_count": 0,
        "created_at": datetime.now(timezone.utc)
    })
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "role": "user"
    }

@auth_router.post("/login")
async def login(user_data: UserLogin, response: Response):
    email = user_data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user")
    }

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "purchased_books": user.get("purchased_books", [])
    }

# ==================== BOOKS ROUTES ====================

@books_router.get("/languages")
async def get_languages():
    return {"languages": LANGUAGES}

@books_router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}

@books_router.get("/list")
async def list_books(language: Optional[str] = None, category: Optional[str] = None):
    query = {"is_published": True}
    if language:
        query["language"] = language
    if category:
        query["category"] = category
    
    books = await db.books.find(query, {"content": 0, "audio_data": 0}).sort("created_at", -1).to_list(100)
    
    for book in books:
        book["_id"] = str(book["_id"])
        book["created_at"] = book["created_at"].isoformat() if isinstance(book.get("created_at"), datetime) else book.get("created_at")
    
    return {"books": books}

@books_router.get("/{book_id}")
async def get_book(book_id: str, request: Request):
    try:
        book = await db.books.find_one({"_id": ObjectId(book_id)}, {"content": 0, "audio_data": 0})
    except:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    book["_id"] = str(book["_id"])
    
    # Check if user owns the book
    user = await get_optional_user(request)
    book["owned"] = False
    if user:
        if book_id in user.get("purchased_books", []) or user.get("role") == "admin":
            book["owned"] = True
    
    # Increment view count
    await db.books.update_one({"_id": ObjectId(book_id)}, {"$inc": {"views": 1}})
    
    return book

@books_router.get("/{book_id}/read")
async def read_book(book_id: str, request: Request, page: int = 1):
    """Read book content - free with ads or purchased without ads"""
    try:
        book = await db.books.find_one({"_id": ObjectId(book_id)})
    except:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    user = await get_optional_user(request)
    owned = False
    if user:
        if book_id in user.get("purchased_books", []) or user.get("role") == "admin":
            owned = True
    
    content = book.get("content", "")
    
    # Split content into pages (approximately 2000 chars per page)
    page_size = 2000
    pages = [content[i:i+page_size] for i in range(0, len(content), page_size)] if content else [""]
    total_pages = len(pages)
    
    current_page = min(max(1, page), total_pages)
    page_content = pages[current_page - 1] if pages else ""
    
    # Track reading
    await db.reading_stats.update_one(
        {"book_id": book_id, "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")},
        {"$inc": {"reads": 1}},
        upsert=True
    )
    
    return {
        "book_id": book_id,
        "title": book.get("title"),
        "content": page_content,
        "current_page": current_page,
        "total_pages": total_pages,
        "show_ads": not owned,
        "owned": owned
    }

@books_router.get("/{book_id}/audio")
async def get_audio(book_id: str, request: Request):
    """Get audio book - free with ads"""
    try:
        book = await db.books.find_one({"_id": ObjectId(book_id)})
    except:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book or not book.get("has_audio"):
        raise HTTPException(status_code=404, detail="Audio not available")
    
    user = await get_optional_user(request)
    owned = False
    if user:
        if book_id in user.get("purchased_books", []) or user.get("role") == "admin":
            owned = True
    
    return {
        "book_id": book_id,
        "title": book.get("title"),
        "audio_url": book.get("audio_url"),
        "duration": book.get("audio_duration"),
        "show_ads": not owned,
        "owned": owned
    }

# ==================== PAYMENT ROUTES ====================

@payment_router.post("/purchase")
async def create_purchase(data: PurchaseCreate, request: Request, user: dict = Depends(get_current_user)):
    try:
        book = await db.books.find_one({"_id": ObjectId(data.book_id)})
    except:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book.get("is_free") or book.get("price", 0) == 0:
        # Free book - add directly
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$addToSet": {"purchased_books": data.book_id}}
        )
        return {"message": "Book added to your library", "free": True}
    
    # Paid book - create Stripe checkout
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{data.origin_url}/library?session_id={{CHECKOUT_SESSION_ID}}&purchase=success"
    cancel_url = f"{data.origin_url}/book/{data.book_id}?purchase=cancelled"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(book["price"]),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["_id"],
            "book_id": data.book_id,
            "book_title": book["title"],
            "type": "book_purchase"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Save transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["_id"],
        "book_id": data.book_id,
        "amount": book["price"],
        "currency": "eur",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"url": session.url, "session_id": session.session_id}

@payment_router.get("/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction.get("payment_status") != "paid" and status.payment_status == "paid":
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
            )
            # Add book to user's library
            await db.users.update_one(
                {"_id": ObjectId(user["_id"])},
                {"$addToSet": {"purchased_books": transaction["book_id"]}}
            )
            # Update purchase count for giveaway
            await db.giveaway_entries.update_one(
                {"user_id": user["_id"]},
                {"$inc": {"purchase_count": 1}},
                upsert=True
            )
            # Update book sales
            await db.books.update_one(
                {"_id": ObjectId(transaction["book_id"])},
                {"$inc": {"sales": 1}}
            )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status
        }
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            user_id = webhook_response.metadata.get("user_id")
            book_id = webhook_response.metadata.get("book_id")
            if user_id and book_id:
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$addToSet": {"purchased_books": book_id}}
                )
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
                )
                await db.giveaway_entries.update_one(
                    {"user_id": user_id},
                    {"$inc": {"purchase_count": 1}},
                    upsert=True
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ==================== ADMIN ROUTES ====================

@admin_router.get("/stats")
async def get_admin_stats(user: dict = Depends(require_admin)):
    total_books = await db.books.count_documents({})
    total_users = await db.users.count_documents({})
    total_sales = await db.payment_transactions.count_documents({"payment_status": "paid"})
    
    # Revenue
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.payment_transactions.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return {
        "total_books": total_books,
        "total_users": total_users,
        "total_sales": total_sales,
        "total_revenue": total_revenue
    }

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_file = io.BytesIO(file_bytes)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise HTTPException(status_code=400, detail=f"Could not extract text from PDF: {str(e)}")

def extract_text_from_epub(file_bytes: bytes) -> str:
    """Extract text from EPUB file"""
    try:
        book = epub.read_epub(io.BytesIO(file_bytes))
        text = ""
        for item in book.get_items():
            if item.get_type() == 9:  # EBOOKLIB.ITEM_DOCUMENT
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text += soup.get_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"EPUB extraction error: {e}")
        raise HTTPException(status_code=400, detail=f"Could not extract text from EPUB: {str(e)}")

async def translate_text(text: str, target_language: str) -> str:
    """Translate text to target language using AI"""
    if not AI_TRANSLATION_ENABLED:
        raise HTTPException(status_code=400, detail="AI Translation not available")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Translation API key not configured")
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translation-{target_language}",
            system_message=f"You are a professional translator. Translate the following text to {LANGUAGES[target_language]['name']}. Preserve formatting and paragraph breaks. Return ONLY the translated text, no explanations."
        ).with_model("openai", "gpt-5.1")
        
        user_message = UserMessage(text=text)
        response = await chat.send_message(user_message)
        return response.strip()
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@admin_router.post("/books")
async def create_book(
    title: str = Form(...),
    description: str = Form(...),
    language: str = Form(...),
    category: str = Form(...),
    price: float = Form(0.0),
    is_free: bool = Form(True),
    content: str = Form(""),
    cover_url: str = Form(""),
    book_file: Optional[UploadFile] = File(None),
    cover_image: Optional[UploadFile] = File(None),
    auto_translate: bool = Form(False),
    user: dict = Depends(require_admin)
):
    if language not in LANGUAGES:
        raise HTTPException(status_code=400, detail="Invalid language")
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    # Extract text from uploaded file if provided
    extracted_content = content
    if book_file:
        if not PDF_EPUB_ENABLED:
            raise HTTPException(status_code=400, detail="PDF/EPUB processing not available")
        
        file_bytes = await book_file.read()
        filename = book_file.filename.lower()
        
        if filename.endswith('.pdf'):
            extracted_content = extract_text_from_pdf(file_bytes)
        elif filename.endswith('.epub'):
            extracted_content = extract_text_from_epub(file_bytes)
        elif filename.endswith('.txt'):
            extracted_content = file_bytes.decode('utf-8', errors='ignore')
        elif filename.endswith('.docx'):
            raise HTTPException(status_code=400, detail="DOCX not supported yet. Please use PDF, EPUB or TXT")
        else:
            raise HTTPException(status_code=400, detail="Only PDF, EPUB and TXT files are supported")
        
        logger.info(f"Extracted {len(extracted_content)} characters from {filename}")
    
    # Handle cover image upload
    final_cover_url = cover_url
    if cover_image:
        try:
            # Generate unique filename
            file_extension = cover_image.filename.split('.')[-1].lower()
            if file_extension not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, GIF images are supported")
            
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = f"static/covers/{unique_filename}"
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(cover_image.file, buffer)
            
            # Generate URL (relative path that frontend can use)
            final_cover_url = f"/api/static/covers/{unique_filename}"
            logger.info(f"Cover image saved: {final_cover_url}")
        except Exception as e:
            logger.error(f"Failed to save cover image: {e}")
            # Continue without cover if upload fails
    
    # Create main book
    book_doc = {
        "title": title,
        "description": description,
        "language": language,
        "category": category,
        "price": price,
        "is_free": is_free,
        "content": extracted_content,
        "cover_url": final_cover_url,
        "has_audio": False,
        "audio_url": None,
        "is_published": True,
        "views": 0,
        "sales": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.books.insert_one(book_doc)
    book_id = str(result.inserted_id)
    
    # Auto-translate to other languages if requested
    translated_count = 0
    if auto_translate and extracted_content:
        if not AI_TRANSLATION_ENABLED:
            return {"id": book_id, "message": "Book created but translation not available", "translated": 0}
        
        target_languages = [lang for lang in LANGUAGES.keys() if lang != language]
        
        for target_lang in target_languages:
            try:
                translated_content = await translate_text(extracted_content[:15000], target_lang)  # Limit to first 15k chars
                translated_title = await translate_text(title, target_lang)
                translated_desc = await translate_text(description, target_lang)
                
                translated_book = {
                    "title": translated_title,
                    "description": translated_desc,
                    "language": target_lang,
                    "category": category,
                    "price": price,
                    "is_free": is_free,
                    "content": translated_content,
                    "cover_url": final_cover_url,
                    "has_audio": False,
                    "audio_url": None,
                    "is_published": True,
                    "views": 0,
                    "sales": 0,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await db.books.insert_one(translated_book)
                translated_count += 1
                logger.info(f"Translated book to {target_lang}")
            except Exception as e:
                logger.error(f"Failed to translate to {target_lang}: {e}")
    
    return {
        "id": book_id, 
        "message": "Book created successfully",
        "translated": translated_count
    }

@admin_router.put("/books/{book_id}")
async def update_book(book_id: str, data: BookUpdate, user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.books.update_one(
        {"_id": ObjectId(book_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    
    return {"message": "Book updated successfully"}

@admin_router.delete("/books/{book_id}")
async def delete_book(book_id: str, user: dict = Depends(require_admin)):
    result = await db.books.delete_one({"_id": ObjectId(book_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book deleted successfully"}

@admin_router.get("/books")
async def list_all_books(user: dict = Depends(require_admin)):
    books = await db.books.find({}, {"content": 0, "audio_data": 0}).sort("created_at", -1).to_list(1000)
    for book in books:
        book["_id"] = str(book["_id"])
    return {"books": books}

@admin_router.get("/giveaway")
async def get_giveaway_stats(user: dict = Depends(require_admin)):
    total_purchases = await db.payment_transactions.count_documents({"payment_status": "paid"})
    
    # Get top buyers for giveaway
    pipeline = [
        {"$match": {"purchase_count": {"$gt": 0}}},
        {"$sort": {"purchase_count": -1}},
        {"$limit": 10}
    ]
    top_buyers = await db.giveaway_entries.aggregate(pipeline).to_list(10)
    
    for buyer in top_buyers:
        buyer["_id"] = str(buyer["_id"])
    
    return {
        "total_purchases": total_purchases,
        "milestone_500": total_purchases >= 500,
        "milestone_1000": total_purchases >= 1000,
        "top_buyers": top_buyers
    }

# ==================== GENERAL ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "FreelancerIonel API", "version": "1.0"}

@api_router.get("/site-info")
async def get_site_info():
    return {
        "name": "FreelancerIonel",
        "tagline": "Cărți electronice în multiple limbi",
        "languages": LANGUAGES,
        "categories": CATEGORIES,
        "features": [
            "Citire online gratuită",
            "Cărți audio",
            "Multiple limbi",
            "Descărcare după cumpărare"
        ]
    }

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.books.create_index([("language", 1), ("category", 1)])
    await db.books.create_index("is_published")
    await db.payment_transactions.create_index("session_id")
    await db.giveaway_entries.create_index("user_id", unique=True)
    await db.reading_stats.create_index([("book_id", 1), ("date", 1)])
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@freelancerionel.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Ionel Apetrei",
            "role": "admin",
            "purchased_books": [],
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# FreelancerIonel Test Credentials\n\n")
        f.write("## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: admin\n\n")
        f.write("- GET /api/books/{id}\n")
        f.write("- GET /api/books/{id}/read\n")
        f.write("- POST /api/admin/books\n")

# Serve static files for cover images
app.mount("/static", StaticFiles(directory="static"), name="static")


# Serve static files for cover images
app.mount("/static", StaticFiles(directory="static"), name="static")
# Include routers
api_router.include_router(auth_router)
api_router.include_router(books_router)
api_router.include_router(admin_router)
api_router.include_router(payment_router)
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
