"""Audit log helper."""
from typing import Optional, Dict, Any
from models import AuditLog
from database import audit_col


async def log_audit(*, action: str, current_user: Optional[dict] = None,
                   school_id: Optional[str] = None,
                   entity_type: Optional[str] = None,
                   entity_id: Optional[str] = None,
                   details: Optional[Dict[str, Any]] = None,
                   ip_address: Optional[str] = None):
    log = AuditLog(
        school_id=school_id or (current_user or {}).get('school_id'),
        user_id=(current_user or {}).get('id'),
        user_name=(current_user or {}).get('full_name'),
        role=(current_user or {}).get('role'),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
    )
    await audit_col.insert_one(log.model_dump())
    return log
