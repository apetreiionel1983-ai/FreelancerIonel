from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutSessionRequest

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# Create the main app
app = FastAPI(title="WriteGenius API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth")
generation_router = APIRouter(prefix="/generation")
payment_router = APIRouter(prefix="/payments")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_premium: bool
    created_at: datetime
    referral_code: Optional[str] = None
    bonus_generations: int = 0

class ReferralStats(BaseModel):
    referral_code: str
    total_referrals: int
    bonus_generations: int
    referral_link: str

class GenerationRequest(BaseModel):
    template: str  # social_media, email, blog, product_description
    prompt: str
    language: str = "English"
    tone: str = "Professional"

class GenerationResponse(BaseModel):
    id: str
    content: str
    template: str
    prompt: str
    created_at: datetime

class CheckoutRequest(BaseModel):
    origin_url: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

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
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code based on user_id"""
    import hashlib
    hash_obj = hashlib.md5(user_id.encode())
    return f"WG{hash_obj.hexdigest()[:8].upper()}"

BONUS_GENERATIONS_PER_REFERRAL = 5  # Bonus generations for each successful referral

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

# ==================== BRUTE FORCE PROTECTION ====================

async def check_brute_force(identifier: str):
    record = await db.login_attempts.find_one({"identifier": identifier})
    if record and record.get("attempts", 0) >= 5:
        lockout_until = record.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < lockout_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

async def record_failed_attempt(identifier: str):
    record = await db.login_attempts.find_one({"identifier": identifier})
    if record:
        attempts = record.get("attempts", 0) + 1
        update = {"$set": {"attempts": attempts}}
        if attempts >= 5:
            update["$set"]["lockout_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.login_attempts.update_one({"identifier": identifier}, update)
    else:
        await db.login_attempts.insert_one({"identifier": identifier, "attempts": 1})

async def clear_failed_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})

# ==================== AUTH ROUTES ====================

@auth_router.post("/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user document
    user_doc = {
        "email": email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "is_premium": False,
        "bonus_generations": 0,
        "total_referrals": 0,
        "referred_by": None,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Generate referral code for new user
    referral_code = generate_referral_code(user_id)
    await db.users.update_one({"_id": result.inserted_id}, {"$set": {"referral_code": referral_code}})
    
    # Handle referral bonus if user was referred
    if user_data.referral_code:
        referrer = await db.users.find_one({"referral_code": user_data.referral_code.upper()})
        if referrer:
            # Give bonus to referrer
            await db.users.update_one(
                {"_id": referrer["_id"]},
                {
                    "$inc": {
                        "bonus_generations": BONUS_GENERATIONS_PER_REFERRAL,
                        "total_referrals": 1
                    }
                }
            )
            # Mark new user as referred
            await db.users.update_one(
                {"_id": result.inserted_id},
                {"$set": {"referred_by": str(referrer["_id"])}}
            )
            # Log referral
            await db.referrals.insert_one({
                "referrer_id": str(referrer["_id"]),
                "referred_id": user_id,
                "referral_code": user_data.referral_code.upper(),
                "created_at": datetime.now(timezone.utc)
            })
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "role": "user",
        "is_premium": False,
        "referral_code": referral_code,
        "bonus_generations": 0,
        "created_at": user_doc["created_at"].isoformat()
    }

@auth_router.post("/login")
async def login(user_data: UserLogin, request: Request, response: Response):
    email = user_data.email.lower()
    client_ip = request.client.host if request.client else "unknown"
    identifier = f"{client_ip}:{email}"
    
    await check_brute_force(identifier)
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await clear_failed_attempts(identifier)
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    # Generate referral code if user doesn't have one
    referral_code = user.get("referral_code")
    if not referral_code:
        referral_code = generate_referral_code(user_id)
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": referral_code}})
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "is_premium": user.get("is_premium", False),
        "referral_code": referral_code,
        "bonus_generations": user.get("bonus_generations", 0),
        "created_at": user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user["created_at"]
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
        "is_premium": user.get("is_premium", False),
        "referral_code": user.get("referral_code"),
        "bonus_generations": user.get("bonus_generations", 0),
        "total_referrals": user.get("total_referrals", 0),
        "created_at": user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user["created_at"]
    }

@auth_router.get("/referral-stats")
async def get_referral_stats(request: Request, user: dict = Depends(get_current_user)):
    referral_code = user.get("referral_code")
    if not referral_code:
        referral_code = generate_referral_code(user["_id"])
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"referral_code": referral_code}})
    
    # Get referral history
    referrals = await db.referrals.find({"referrer_id": user["_id"]}).to_list(100)
    
    # Get referred users' basic info
    referred_users = []
    for ref in referrals:
        referred_user = await db.users.find_one({"_id": ObjectId(ref["referred_id"])}, {"name": 1, "created_at": 1})
        if referred_user:
            referred_users.append({
                "name": referred_user["name"],
                "joined_at": ref["created_at"].isoformat() if isinstance(ref["created_at"], datetime) else ref["created_at"]
            })
    
    # Build referral link
    origin = request.headers.get("origin", "https://writegenius.com")
    referral_link = f"{origin}/register?ref={referral_code}"
    
    return {
        "referral_code": referral_code,
        "referral_link": referral_link,
        "total_referrals": user.get("total_referrals", 0),
        "bonus_generations": user.get("bonus_generations", 0),
        "bonus_per_referral": BONUS_GENERATIONS_PER_REFERRAL,
        "referred_users": referred_users
    }

@auth_router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@auth_router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": str(user["_id"]),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False
    })
    
    logger.info(f"Password reset link: /reset-password?token={token}")
    return {"message": "If the email exists, a reset link has been sent"}

@auth_router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm):
    record = await db.password_reset_tokens.find_one({"token": data.token, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if datetime.now(timezone.utc) > record["expires_at"]:
        raise HTTPException(status_code=400, detail="Token expired")
    
    await db.users.update_one(
        {"_id": ObjectId(record["user_id"])},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"message": "Password reset successfully"}

# ==================== GENERATION ROUTES ====================

TEMPLATES = {
    "social_media": "You are an expert social media content creator. Create engaging, shareable content.",
    "email": "You are a professional email copywriter. Write clear, compelling emails.",
    "blog": "You are a skilled blog writer. Create informative, engaging blog content.",
    "product_description": "You are an e-commerce copywriter. Write persuasive product descriptions."
}

FREE_DAILY_LIMIT = 5

async def get_user_generation_count(user_id: str) -> int:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = await db.generations.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today}
    })
    return count

@generation_router.post("/generate")
async def generate_content(data: GenerationRequest, user: dict = Depends(get_current_user)):
    user_id = user["_id"]
    is_premium = user.get("is_premium", False)
    bonus_generations = user.get("bonus_generations", 0)
    
    # Check generation limit for free users (base + bonus)
    if not is_premium:
        count = await get_user_generation_count(user_id)
        effective_limit = FREE_DAILY_LIMIT + bonus_generations
        if count >= effective_limit:
            raise HTTPException(status_code=403, detail="Daily limit reached. Upgrade to Premium for unlimited generations or invite friends for bonus generations!")
    
    if data.template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid template")
    
    # Generate content using AI
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"gen_{user_id}_{datetime.now().timestamp()}",
            system_message=f"{TEMPLATES[data.template]} Always respond in {data.language}. Use a {data.tone} tone."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=data.prompt)
        generated_content = await chat.send_message(user_message)
        
        # Save generation to database
        generation_doc = {
            "user_id": user_id,
            "template": data.template,
            "prompt": data.prompt,
            "language": data.language,
            "tone": data.tone,
            "content": generated_content,
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.generations.insert_one(generation_doc)
        
        return {
            "id": str(result.inserted_id),
            "content": generated_content,
            "template": data.template,
            "prompt": data.prompt,
            "created_at": generation_doc["created_at"].isoformat()
        }
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate content")

@generation_router.get("/history")
async def get_generation_history(user: dict = Depends(get_current_user)):
    user_id = user["_id"]
    generations = await db.generations.find(
        {"user_id": user_id},
        {"_id": 1, "template": 1, "prompt": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return [{
        "id": str(g["_id"]),
        "template": g["template"],
        "prompt": g["prompt"],
        "content": g["content"],
        "created_at": g["created_at"].isoformat() if isinstance(g["created_at"], datetime) else g["created_at"]
    } for g in generations]

@generation_router.get("/usage")
async def get_usage_stats(user: dict = Depends(get_current_user)):
    user_id = user["_id"]
    is_premium = user.get("is_premium", False)
    bonus_generations = user.get("bonus_generations", 0)
    today_count = await get_user_generation_count(user_id)
    total_count = await db.generations.count_documents({"user_id": user_id})
    
    # Effective daily limit includes bonus generations
    effective_limit = FREE_DAILY_LIMIT + bonus_generations if not is_premium else None
    remaining = None if is_premium else max(0, effective_limit - today_count)
    
    return {
        "today": today_count,
        "total": total_count,
        "daily_limit": effective_limit,
        "base_limit": FREE_DAILY_LIMIT,
        "bonus_generations": bonus_generations,
        "is_premium": is_premium,
        "remaining": remaining
    }

# ==================== PAYMENT ROUTES ====================

PREMIUM_PRICE = 8.00  # €8 per month

@payment_router.post("/create-checkout")
async def create_checkout(data: CheckoutRequest, request: Request, user: dict = Depends(get_current_user)):
    if user.get("is_premium"):
        raise HTTPException(status_code=400, detail="Already premium")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{data.origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
    cancel_url = f"{data.origin_url}/pricing?payment=cancelled"
    
    checkout_request = CheckoutSessionRequest(
        amount=PREMIUM_PRICE,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["_id"],
            "user_email": user["email"],
            "product": "writegenius_premium"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Save transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["_id"],
        "email": user["email"],
        "amount": PREMIUM_PRICE,
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
        
        # Update transaction status
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction.get("payment_status") != "paid" and status.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
            )
            # Upgrade user to premium
            await db.users.update_one(
                {"_id": ObjectId(user["_id"])},
                {"$set": {"is_premium": True, "premium_since": datetime.now(timezone.utc)}}
            )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency
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
            if user_id:
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"is_premium": True, "premium_since": datetime.now(timezone.utc)}}
                )
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ==================== GENERAL ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "WriteGenius API", "version": "1.0"}

@api_router.get("/templates")
async def get_templates():
    return {
        "templates": [
            {"id": "social_media", "name": "Social Media Post", "description": "Create engaging posts for social platforms"},
            {"id": "email", "name": "Email", "description": "Write professional emails"},
            {"id": "blog", "name": "Blog Post", "description": "Generate blog articles"},
            {"id": "product_description", "name": "Product Description", "description": "Write compelling product copy"}
        ]
    }

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("referral_code", unique=True, sparse=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.generations.create_index([("user_id", 1), ("created_at", -1)])
    await db.payment_transactions.create_index("session_id")
    await db.referrals.create_index("referrer_id")
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@writegenius.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "is_premium": True,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# WriteGenius Test Credentials\n\n")
        f.write("## Admin User\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: admin\n")
        f.write("- Premium: Yes\n\n")
        f.write("## Test User (create via registration)\n")
        f.write("- Email: test@example.com\n")
        f.write("- Password: test123\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/register\n")
        f.write("- POST /api/auth/login\n")
        f.write("- POST /api/auth/logout\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/refresh\n")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include routers
api_router.include_router(auth_router)
api_router.include_router(generation_router)
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
