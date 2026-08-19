"""Pydantic models for Stanvard School ERP."""
from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ---------- SCHOOL ----------
class School(BaseDoc):
    name: str
    code: str  # short code e.g. GN, KNP, AYR
    city: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    principal_name: Optional[str] = None
    logo_url: Optional[str] = None
    academic_session: str = '2025-26'
    status: str = 'active'  # active | archived


class SchoolCreate(BaseModel):
    name: str
    code: str
    city: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    principal_name: Optional[str] = None
    academic_session: str = '2025-26'


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    principal_name: Optional[str] = None
    logo_url: Optional[str] = None
    academic_session: Optional[str] = None
    status: Optional[str] = None


# ---------- USER / AUTH ----------
ROLES = {'super_admin', 'school_admin', 'accountant', 'teacher', 'parent', 'owner'}


class User(BaseDoc):
    email: EmailStr
    password_hash: str
    full_name: str
    role: str  # super_admin|school_admin|accountant|teacher|parent
    school_id: Optional[str] = None  # None for super_admin
    phone: Optional[str] = None
    linked_student_id: Optional[str] = None  # DEPRECATED: single-child parent (legacy)
    linked_student_ids: List[str] = Field(default_factory=list)  # parent role: list of children
    linked_class_ids: List[str] = Field(default_factory=list)  # for teacher
    status: str = 'active'


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    school_id: Optional[str] = None
    phone: Optional[str] = None
    linked_student_id: Optional[str] = None  # legacy single-child support
    linked_student_ids: List[str] = Field(default_factory=list)  # parent's children
    linked_class_ids: List[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    school_id: Optional[str] = None
    phone: Optional[str] = None
    linked_student_id: Optional[str] = None  # legacy
    linked_student_ids: Optional[List[str]] = None  # replaces the list when provided
    linked_class_ids: Optional[List[str]] = None
    status: Optional[str] = None
    password: Optional[str] = None


class LoginRequest(BaseModel):
    # Accepts either an email or a mobile number as the identifier.
    # Frontend still sends `email` for backwards compatibility.
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: Dict[str, Any]


# ---------- STUDENT ----------
class Student(BaseDoc):
    school_id: str
    admission_number: str
    roll_number: Optional[str] = None
    full_name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    religion: Optional[str] = None
    category: Optional[str] = None
    class_id: Optional[str] = None
    section: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    guardian_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    transport_route: Optional[str] = None
    medical_info: Optional[str] = None
    previous_school: Optional[str] = None
    scholarship: Optional[str] = None
    fee_category: Optional[str] = None
    photo_url: Optional[str] = None
    documents: List[Dict[str, str]] = Field(default_factory=list)
    remarks: Optional[str] = None
    admission_date: Optional[str] = None
    status: str = 'active'


class StudentCreate(BaseModel):
    school_id: Optional[str] = None  # inferred from user context
    admission_number: Optional[str] = None  # auto-gen if empty
    roll_number: Optional[str] = None
    full_name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    religion: Optional[str] = None
    category: Optional[str] = None
    class_id: Optional[str] = None
    section: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    guardian_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    transport_route: Optional[str] = None
    medical_info: Optional[str] = None
    previous_school: Optional[str] = None
    scholarship: Optional[str] = None
    fee_category: Optional[str] = None
    photo_url: Optional[str] = None
    remarks: Optional[str] = None
    admission_date: Optional[str] = None


class StudentUpdate(BaseModel):
    admission_number: Optional[str] = None
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    religion: Optional[str] = None
    category: Optional[str] = None
    class_id: Optional[str] = None
    section: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    guardian_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    transport_route: Optional[str] = None
    medical_info: Optional[str] = None
    previous_school: Optional[str] = None
    scholarship: Optional[str] = None
    fee_category: Optional[str] = None
    photo_url: Optional[str] = None
    remarks: Optional[str] = None
    admission_date: Optional[str] = None
    status: Optional[str] = None


# ---------- CLASS ----------
class ClassRoom(BaseDoc):
    school_id: str
    name: str  # e.g. Class VIII
    sections: List[str] = Field(default_factory=list)  # ['A','B','C']
    teacher_id: Optional[str] = None


class ClassCreate(BaseModel):
    school_id: Optional[str] = None
    name: str
    sections: List[str] = Field(default_factory=list)
    teacher_id: Optional[str] = None


# ---------- FEE ----------
class FeeHead(BaseDoc):
    school_id: str
    name: str  # Tuition, Transport, etc.
    category: str = 'general'  # general|transport|hostel|exam|activity
    is_active: bool = True


class FeeHeadCreate(BaseModel):
    school_id: Optional[str] = None
    name: str
    category: str = 'general'


class FeePlanItem(BaseModel):
    fee_head_id: str
    fee_head_name: str
    amount: float
    frequency: str = 'monthly'  # monthly|quarterly|half_yearly|yearly|one_time
    installments: int = 12  # for monthly=12, quarterly=4, half_yearly=2, yearly=1
    one_time_month: Optional[int] = None  # 1..12 target month for one_time items (else first collection month)


class PlanMonthDiscount(BaseModel):
    """A discount targeting one specific month's installment within a plan.
    `type` is 'flat' (₹ off) or 'percent' (% off that month's base amount)."""
    month: int  # 1..12
    type: str = 'flat'  # flat | percent
    value: float = 0.0


class PlanMonthAmount(BaseModel):
    """An explicit override of a single month's payable amount within a plan.
    When present, this amount is used for that month instead of the equal split."""
    month: int  # 1..12
    amount: float = 0.0


class FeePlan(BaseDoc):
    school_id: str
    name: str  # e.g. 'Class VIII 2025-26'
    academic_session: str = '2025-26'
    class_id: Optional[str] = None  # if class-wide plan
    items: List[FeePlanItem] = Field(default_factory=list)
    annual_discount_percent: float = 0.0  # early payment discount %
    late_fee_amount: float = 0.0
    late_fee_after_day: int = 10  # apply late fee after day X of month
    is_active: bool = True
    status: str = 'draft'  # live | draft — only ONE live plan per class+session auto-assigns
    # ---- Plan-baked discounts (part of the plan; NO owner approval) ----
    plan_discount_type: Optional[str] = None   # 'flat' | 'percent' | None
    plan_discount_value: float = 0.0
    yearly_discount_type: Optional[str] = None  # full-session lump: 'flat' | 'percent' | None
    yearly_discount_value: float = 0.0
    month_discounts: List[PlanMonthDiscount] = Field(default_factory=list)
    installment_discounts: List[PlanMonthDiscount] = Field(default_factory=list)
    # Explicit per-month amount overrides (month -> amount). Empty = equal split.
    month_amounts: List[PlanMonthAmount] = Field(default_factory=list)


class FeePlanCreate(BaseModel):
    school_id: Optional[str] = None
    name: str
    academic_session: str = '2025-26'
    class_id: Optional[str] = None
    items: List[FeePlanItem] = Field(default_factory=list)
    annual_discount_percent: float = 0.0
    late_fee_amount: float = 0.0
    late_fee_after_day: int = 10
    plan_discount_type: Optional[str] = None
    plan_discount_value: float = 0.0
    yearly_discount_type: Optional[str] = None
    yearly_discount_value: float = 0.0
    month_discounts: List[PlanMonthDiscount] = Field(default_factory=list)
    installment_discounts: List[PlanMonthDiscount] = Field(default_factory=list)
    month_amounts: List[PlanMonthAmount] = Field(default_factory=list)
    status: Optional[str] = None  # 'live' | 'draft'; None on create -> auto-decided


class FeeAssignmentItem(BaseModel):
    fee_head_id: Optional[str] = None
    fee_head_name: str
    amount: float
    frequency: str = 'monthly'
    due_date: Optional[str] = None  # YYYY-MM-DD


class FeeAssignmentInstallment(BaseModel):
    """A single installment row in the monthly fee timeline.
    - month is 1..12 (April = 4). year is the actual calendar year.
    - amount is the installment amount (may be edited by admin).
    - due_date is ISO YYYY-MM-DD.
    - status controls the label shown to the parent — 'active' months are
      chargeable; 'skip' months are 'No Fee' (e.g. Summer Vacation, Session End).
    """
    month: int
    year: int
    amount: float = 0.0
    due_date: Optional[str] = None
    last_payment_date: Optional[str] = None  # last day of the month
    label: Optional[str] = None  # optional label e.g. "Summer Vacation"
    status: str = 'active'  # active | skip


class FeeAssignment(BaseDoc):
    school_id: str
    student_id: str
    fee_plan_id: Optional[str] = None  # null when fully custom
    academic_session: str = '2025-26'
    custom_items: List[FeeAssignmentItem] = Field(default_factory=list)
    custom_amount: Optional[float] = None  # override total
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    discount_reason: Optional[str] = None
    due_date: Optional[str] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    # ---- Monthly collection configuration (Oct 2026 upgrade) ----
    collection_months: List[int] = Field(default_factory=lambda: [4, 5, 7, 8, 9, 10, 11, 12, 1, 2])
    installments: List[FeeAssignmentInstallment] = Field(default_factory=list)
    due_day_of_month: int = 15  # school policy: fees due by this day each month
    is_draft: bool = False       # true when saved via "Save Draft"
    copied_from_assignment_id: Optional[str] = None  # traceability for Copy-Previous-Year
    status: str = 'active'


class FeeAssignmentCreate(BaseModel):
    school_id: Optional[str] = None
    student_id: str
    fee_plan_id: Optional[str] = None
    academic_session: str = '2025-26'
    custom_items: List[FeeAssignmentItem] = Field(default_factory=list)
    custom_amount: Optional[float] = None
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    discount_reason: Optional[str] = None
    due_date: Optional[str] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    collection_months: Optional[List[int]] = None
    installments: Optional[List[FeeAssignmentInstallment]] = None
    due_day_of_month: Optional[int] = 15
    is_draft: bool = False
    notify_parent: bool = False           # transient — triggers Notification creation
    copied_from_assignment_id: Optional[str] = None


class FeeAssignmentUpdate(BaseModel):
    fee_plan_id: Optional[str] = None
    custom_items: Optional[List[FeeAssignmentItem]] = None
    custom_amount: Optional[float] = None
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    due_date: Optional[str] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    collection_months: Optional[List[int]] = None
    installments: Optional[List[FeeAssignmentInstallment]] = None
    due_day_of_month: Optional[int] = None
    is_draft: Optional[bool] = None
    notify_parent: Optional[bool] = None
    status: Optional[str] = None


# ---------- PAYMENT / RECEIPT ----------
class PaymentLineItem(BaseModel):
    fee_head_id: Optional[str] = None
    fee_head_name: str
    period: str = ''  # e.g. 'October 2025' or 'Annual'
    amount: float


class Payment(BaseDoc):
    school_id: str
    student_id: str
    student_name: str = ''
    receipt_number: str = ''
    items: List[PaymentLineItem] = Field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0
    late_fee: float = 0.0
    total_paid: float = 0.0
    payment_mode: str = 'cash'  # cash|upi|card|cheque|bank_transfer|razorpay
    txn_ref: Optional[str] = None  # UPI ref / cheque no / bank txn / razorpay payment id
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    status: str = 'success'  # success|pending|refunded|failed|voided
    remarks: Optional[str] = None
    collected_by_id: Optional[str] = None
    collected_by_name: Optional[str] = None
    paid_at: str = Field(default_factory=now_iso)
    # --- Super-admin edit / void trail ---
    edit_history: List[dict] = Field(default_factory=list)
    edited_at: Optional[str] = None
    edited_by_id: Optional[str] = None
    edited_by_name: Optional[str] = None
    edited_reason: Optional[str] = None
    voided_at: Optional[str] = None
    voided_by_id: Optional[str] = None
    voided_by_name: Optional[str] = None
    void_reason: Optional[str] = None


class PaymentCreate(BaseModel):
    school_id: Optional[str] = None
    student_id: str
    items: List[PaymentLineItem]
    discount: float = 0
    late_fee: float = 0
    payment_mode: str = 'cash'
    txn_ref: Optional[str] = None
    remarks: Optional[str] = None
    discount_reason: Optional[str] = None  # Required when discount > 0 (owner approval)
    application_image: Optional[str] = None  # base64 data URL of parent's written application; required when discount > 0


class DiscountApproval(BaseDoc):
    """Approval request raised whenever an admin/accountant applies a discount
    on a manual (offline) payment. Two-stage workflow:
      1) Owner reviews & approves (optionally editing the discount amount).
         No payment is created at this stage.
      2) The admin resumes the transaction, collects the money, and only then
         is the Payment + receipt generated (via /discount-approvals/{id}/collect).
    """
    school_id: str
    student_id: str
    student_name: str = ''
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    admission_number: Optional[str] = None
    items: List[PaymentLineItem] = Field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0            # Discount amount originally REQUESTED by the admin
    approved_discount: Optional[float] = None  # Final discount after owner review (may differ)
    late_fee: float = 0.0
    total: float = 0.0               # Net payable using approved_discount (or original) — recomputed on approve/collect
    payment_mode: str = 'cash'
    txn_ref: Optional[str] = None
    remarks: Optional[str] = None
    discount_reason: str = ''
    application_image: str = ''      # base64 data URL — MANDATORY. Written application from parent.
    status: str = 'pending'          # pending | approved | collected | rejected
    requested_by_id: Optional[str] = None
    requested_by_name: Optional[str] = None
    requested_by_role: Optional[str] = None
    requested_at: str = Field(default_factory=now_iso)
    reviewed_by_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_remark: Optional[str] = None
    collected_by_id: Optional[str] = None
    collected_by_name: Optional[str] = None
    collected_at: Optional[str] = None
    payment_id: Optional[str] = None       # populated after collection
    receipt_number: Optional[str] = None   # populated after collection


class DiscountApprovalReview(BaseModel):
    remark: Optional[str] = None
    approved_discount: Optional[float] = None  # Owner may override the requested discount


class DiscountApprovalCollect(BaseModel):
    """Body for /discount-approvals/{id}/collect — the admin resumes the
    approved discount request, collects money, and requests receipt generation."""
    payment_mode: str = 'cash'
    txn_ref: Optional[str] = None
    remarks: Optional[str] = None


class PaymentEdit(BaseModel):
    """Super-admin edit request. student_id cannot be changed."""
    items: Optional[List[PaymentLineItem]] = None
    discount: Optional[float] = None
    late_fee: Optional[float] = None
    payment_mode: Optional[str] = None
    txn_ref: Optional[str] = None
    remarks: Optional[str] = None
    paid_at: Optional[str] = None
    reason: str  # required — audit trail


class PaymentVoid(BaseModel):
    reason: str  # required


class RazorpayOrderRequest(BaseModel):
    student_id: str
    items: List[PaymentLineItem]
    discount: float = 0.0
    late_fee: float = 0.0
    remarks: Optional[str] = None


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ---------- ATTENDANCE ----------
class AttendanceRecord(BaseDoc):
    school_id: str
    date: str  # YYYY-MM-DD
    class_id: str
    section: Optional[str] = None
    student_id: str
    status: str = 'present'  # present|absent|leave
    remarks: Optional[str] = None
    marked_by_id: Optional[str] = None


class AttendanceBulkMark(BaseModel):
    school_id: Optional[str] = None
    date: str
    class_id: str
    section: Optional[str] = None
    entries: List[Dict[str, str]]  # [{student_id, status, remarks?}]


# ---------- HOMEWORK ----------
class Homework(BaseDoc):
    school_id: str
    class_id: str
    section: Optional[str] = None
    subject: str
    title: str
    description: str
    due_date: Optional[str] = None
    attachment_url: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None


class HomeworkCreate(BaseModel):
    school_id: Optional[str] = None
    class_id: str
    section: Optional[str] = None
    subject: str
    title: str
    description: str
    due_date: Optional[str] = None
    attachment_url: Optional[str] = None


# ---------- TIMETABLE ----------
class TimetableSlot(BaseModel):
    day: str  # Monday..Saturday
    period: int  # 1..8
    start_time: str  # '09:00'
    end_time: str  # '09:45'
    subject: str
    teacher_name: Optional[str] = None


class Timetable(BaseDoc):
    school_id: str
    class_id: str
    section: Optional[str] = None
    slots: List[TimetableSlot] = Field(default_factory=list)


class TimetableCreate(BaseModel):
    school_id: Optional[str] = None
    class_id: str
    section: Optional[str] = None
    slots: List[TimetableSlot]


# ---------- EVENT ----------
class Event(BaseDoc):
    school_id: str
    title: str
    description: Optional[str] = None
    event_date: str  # YYYY-MM-DD
    location: Optional[str] = None
    image_url: Optional[str] = None
    status: str = 'upcoming'  # upcoming|past


class EventCreate(BaseModel):
    school_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    event_date: str
    location: Optional[str] = None
    image_url: Optional[str] = None


# ---------- CIRCULAR ----------
class Circular(BaseDoc):
    school_id: str
    title: str
    body: str
    priority: str = 'normal'  # low|normal|high|urgent
    status: str = 'published'  # draft|scheduled|published
    publish_at: Optional[str] = None
    attachment_url: Optional[str] = None
    audience: str = 'all'  # all|teachers|parents|students|class
    class_id: Optional[str] = None
    created_by_name: Optional[str] = None


class CircularCreate(BaseModel):
    school_id: Optional[str] = None
    title: str
    body: str
    priority: str = 'normal'
    status: str = 'published'
    publish_at: Optional[str] = None
    attachment_url: Optional[str] = None
    audience: str = 'all'
    class_id: Optional[str] = None


# ---------- GALLERY ----------
class GalleryAlbum(BaseDoc):
    school_id: str
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    photos: List[str] = Field(default_factory=list)  # image URLs


class GalleryAlbumCreate(BaseModel):
    school_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    photos: List[str] = Field(default_factory=list)


# ---------- STAFF ----------
class Staff(BaseDoc):
    school_id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: str  # Teacher|Principal|Accountant|Clerk
    department: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    joining_date: Optional[str] = None
    photo_url: Optional[str] = None
    status: str = 'active'


class StaffCreate(BaseModel):
    school_id: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: str
    department: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    joining_date: Optional[str] = None
    photo_url: Optional[str] = None


# ---------- NOTIFICATION ----------
class Notification(BaseDoc):
    school_id: str
    title: str
    body: str
    audience: str = 'all'  # all|teachers|parents|class|student
    class_id: Optional[str] = None
    student_ids: List[str] = Field(default_factory=list)
    kind: str = 'announcement'  # announcement|homework|fee_reminder|exam|emergency
    read_by: List[str] = Field(default_factory=list)


class NotificationCreate(BaseModel):
    school_id: Optional[str] = None
    title: str
    body: str
    audience: str = 'all'
    class_id: Optional[str] = None
    student_ids: List[str] = Field(default_factory=list)
    kind: str = 'announcement'


# ---------- AUDIT ----------
class AuditLog(BaseDoc):
    school_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    role: Optional[str] = None
    action: str  # e.g. 'student.create', 'payment.collect'
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None


# ---------- SETTINGS ----------
class SchoolSettings(BaseDoc):
    school_id: str
    theme: str = 'default'
    receipt_template: Dict[str, Any] = Field(default_factory=dict)
    late_fee_rules: Dict[str, Any] = Field(default_factory=dict)
    discount_rules: Dict[str, Any] = Field(default_factory=dict)


# ---------- EXAMINATIONS ----------
class ExamSubject(BaseModel):
    name: str
    max_marks: float = 100.0


class Exam(BaseDoc):
    school_id: str
    name: str  # e.g. 'Half-Yearly Examination'
    term: str = ''  # e.g. 'Term 1'
    academic_session: str = '2025-26'
    class_id: str
    section: Optional[str] = None  # None = all sections
    subjects: List[ExamSubject] = Field(default_factory=list)
    exam_date: Optional[str] = None  # YYYY-MM-DD
    status: str = 'scheduled'  # scheduled|ongoing|completed|published


class ExamCreate(BaseModel):
    school_id: Optional[str] = None
    name: str
    term: Optional[str] = ''
    academic_session: str = '2025-26'
    class_id: str
    section: Optional[str] = None
    subjects: List[ExamSubject] = Field(default_factory=list)
    exam_date: Optional[str] = None


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    term: Optional[str] = None
    exam_date: Optional[str] = None
    status: Optional[str] = None


class MarkEntry(BaseModel):
    student_id: str
    marks: Dict[str, Optional[float]] = Field(default_factory=dict)  # subject -> marks; None = absent/not entered


class MarksBulkSave(BaseModel):
    entries: List[MarkEntry]


# ---------- TWILIO MESSAGING ----------
class FeeReminderRequest(BaseModel):
    month: int  # calendar month number 1-12
    channel: str = 'sms'  # sms | whatsapp | both
    class_id: Optional[str] = None
    school_id: Optional[str] = None
