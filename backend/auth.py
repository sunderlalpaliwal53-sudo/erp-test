"""Authentication utilities: password hashing, JWT, current user dependency, RBAC."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext

from database import users_col

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-please')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', '1440'))

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login', auto_error=False)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)):
    # Support both Authorization: Bearer and 'token' cookie
    if not token:
        auth = request.headers.get('Authorization', '')
        if auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid token')
    except JWTError:
        raise HTTPException(status_code=401, detail='Invalid token')

    user = await users_col.find_one({'id': user_id}, {'_id': 0})
    if not user or user.get('status') != 'active':
        raise HTTPException(status_code=401, detail='User not found or inactive')
    return user


def require_roles(*allowed_roles: str):
    async def _dep(current_user=Depends(get_current_user)):
        if current_user['role'] not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(allowed_roles)}")
        return current_user
    return _dep


from typing import Optional

# Module-level cache of "first school id" for the defensive fallback below.
# Populated lazily on first call; refreshed only if the school no longer exists.
_default_school_cache: Optional[str] = None


def _read_first_school_id_sync() -> Optional[str]:
    """Best-effort synchronous lookup of the first school id via PyMongo.
    Used by resolve_school_id when a super_admin request arrives without any
    school scope selected (e.g. a race between SchoolContext hydration and
    the first API call after login). Cached in-process."""
    global _default_school_cache
    if _default_school_cache:
        return _default_school_cache
    try:
        from pymongo import MongoClient
        import os as _os
        _c = MongoClient(_os.environ['MONGO_URL'], serverSelectionTimeoutMS=1500)
        _db = _c[_os.environ.get('DB_NAME', 'stanvard_erp')]
        doc = _db['schools'].find_one({'status': {'$ne': 'deleted'}}, {'_id': 0, 'id': 1}, sort=[('code', 1)])
        _c.close()
        if doc and doc.get('id'):
            _default_school_cache = doc['id']
            return _default_school_cache
    except Exception:
        pass
    return None


def resolve_school_id(current_user: dict, requested_school_id: Optional[str], x_school_id: Optional[str] = None) -> str:
    """Resolve which school to scope the operation to.
    - super_admin can specify any school via requested_school_id or X-School-Id header.
    - Others are locked to their assigned school.
    - Defensive: if a super_admin request arrives with NO school scope
      (usually due to a first-load timing race), we fall back to the
      first active school instead of raising 400. This keeps the UI
      resilient during initial context hydration.
    """
    if current_user['role'] == 'super_admin':
        sid = requested_school_id or x_school_id
        if sid:
            return sid
        default = _read_first_school_id_sync()
        if default:
            return default
        raise HTTPException(status_code=400, detail='No schools configured yet')
    if not current_user.get('school_id'):
        raise HTTPException(status_code=403, detail='User has no assigned school')
    return current_user['school_id']


async def _default_school_id_for(current_user: dict) -> Optional[str]:
    """Async variant kept for backward compat; delegates to sync helper."""
    if current_user.get('school_id'):
        return current_user['school_id']
    return _read_first_school_id_sync()


async def resolve_school_id_safe(current_user: dict, requested_school_id: Optional[str], x_school_id: Optional[str]) -> str:
    return resolve_school_id(current_user, requested_school_id, x_school_id)


async def current_school_id(request: Request, current_user=Depends(get_current_user)) -> str:
    """FastAPI dependency to get the currently-active school scope.
    Reads X-School-Id header for super admins, else uses user's school.
    """
    x = request.headers.get('X-School-Id')
    return resolve_school_id(current_user, None, x)
