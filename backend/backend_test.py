"""
Comprehensive backend API tests for Stanvard School ERP - Real Data Migration
Tests all authentication, parent access, data integrity, and regression features.
"""
import requests
import sys
from typing import Dict, Any, List, Optional

BASE_URL = "https://code-standard-1.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class TestRunner:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.tokens: Dict[str, str] = {}
        self.test_data: Dict[str, Any] = {}
        
    def log(self, msg: str, color: str = Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")
    
    def test(self, name: str, method: str, endpoint: str, 
             expected_status: int, token: Optional[str] = None,
             data: Optional[Dict] = None, params: Optional[Dict] = None,
             validate_fn: Optional[callable] = None) -> tuple[bool, Any]:
        """Run a single API test"""
        url = f"{BASE_URL}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        self.tests_run += 1
        print(f"\n🔍 Test #{self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            status_match = response.status_code == expected_status
            
            if not status_match:
                self.tests_failed += 1
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}", Colors.RED)
                try:
                    self.log(f"   Response: {response.json()}", Colors.RED)
                except Exception:
                    self.log(f"   Response: {response.text[:200]}", Colors.RED)
                return False, None
            
            # Parse response
            try:
                resp_data = response.json()
            except Exception:
                resp_data = None
            
            # Run custom validation if provided
            if validate_fn:
                try:
                    validation_result = validate_fn(resp_data)
                    if not validation_result:
                        self.tests_failed += 1
                        self.log("❌ FAILED - Validation failed", Colors.RED)
                        return False, resp_data
                except Exception as e:
                    self.tests_failed += 1
                    self.log(f"❌ FAILED - Validation error: {str(e)}", Colors.RED)
                    return False, resp_data
            
            self.tests_passed += 1
            self.log(f"✅ PASSED - Status: {response.status_code}", Colors.GREEN)
            return True, resp_data
            
        except requests.exceptions.Timeout:
            self.tests_failed += 1
            self.log("❌ FAILED - Request timeout", Colors.RED)
            return False, None
        except Exception as e:
            self.tests_failed += 1
            self.log(f"❌ FAILED - Error: {str(e)}", Colors.RED)
            return False, None
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print("📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.END}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"{'='*60}\n")


def main():
    runner = TestRunner()
    
    runner.log("\n" + "="*60, Colors.BLUE)
    runner.log("STANVARD SCHOOL ERP - BACKEND API TESTS", Colors.BLUE)
    runner.log("Real Data Migration Testing (375 Students)", Colors.BLUE)
    runner.log("="*60 + "\n", Colors.BLUE)
    
    # ========================================================================
    # SECTION 1: AUTHENTICATION TESTS
    # ========================================================================
    runner.log("\n📋 SECTION 1: AUTHENTICATION TESTS", Colors.YELLOW)
    
    # Test 1a: Super admin login
    success, resp = runner.test(
        "Super admin login (email)",
        "POST", "/auth/login", 200,
        data={"email": "superadmin@stanvard.school", "password": "Stanvard@2026"},
        validate_fn=lambda r: r and r.get('user', {}).get('role') == 'super_admin'
    )
    if success:
        runner.tokens['super_admin'] = resp['access_token']
        runner.test_data['super_admin_user'] = resp['user']
    
    # Test 1b: Accountant login
    success, resp = runner.test(
        "Accountant login (email)",
        "POST", "/auth/login", 200,
        data={"email": "accountant@stanvard.school", "password": "Accountant@2026"},
        validate_fn=lambda r: r and r.get('user', {}).get('role') == 'accountant'
    )
    if success:
        runner.tokens['accountant'] = resp['access_token']
        runner.test_data['accountant_user'] = resp['user']
    
    # Test 1c: Parent login with mobile (3 kids)
    success, resp = runner.test(
        "Parent login with mobile number (3 children)",
        "POST", "/auth/login", 200,
        data={"email": "9784756210", "password": "756210"},
        validate_fn=lambda r: (
            r and 
            r.get('user', {}).get('role') == 'parent' and
            len(r.get('user', {}).get('linked_student_ids', [])) == 3
        )
    )
    if success:
        runner.tokens['parent_multi'] = resp['access_token']
        runner.test_data['parent_multi_user'] = resp['user']
        runner.test_data['parent_multi_kids'] = resp['user'].get('linked_student_ids', [])
        runner.log(f"   Parent has {len(runner.test_data['parent_multi_kids'])} linked children", Colors.GREEN)
    
    # Test 1d: Parent login with +91 prefix
    success, resp = runner.test(
        "Parent login with +91 prefix and spaces",
        "POST", "/auth/login", 200,
        data={"email": "+91 9784756210", "password": "756210"},
        validate_fn=lambda r: r and r.get('user', {}).get('role') == 'parent'
    )
    
    # Test 1e: Parent login with wrong password
    runner.test(
        "Parent login with wrong password (should fail)",
        "POST", "/auth/login", 401,
        data={"email": "9079111899", "password": "wrongpw"}
    )
    
    # Test 1f: Login with nonexistent identifier
    success, resp = runner.test(
        "Login with nonexistent identifier (should fail)",
        "POST", "/auth/login", 401,
        data={"email": "nonexistent@test.com", "password": "test123"},
        validate_fn=lambda r: r and 'Invalid credentials' in str(r.get('detail', ''))
    )
    
    # Test 1g: Mobile-only identifier should NOT get 422 validation error
    success, resp = runner.test(
        "Mobile-only identifier validation (should accept, not 422)",
        "POST", "/auth/login", 401,  # 401 for wrong password, NOT 422 for validation
        data={"email": "9784756210", "password": "wrongpass"}
    )
    
    # Test 1h: Single-child parent login
    success, resp = runner.test(
        "Parent login (single child)",
        "POST", "/auth/login", 200,
        data={"email": "9079111899", "password": "111899"},
        validate_fn=lambda r: r and r.get('user', {}).get('role') == 'parent'
    )
    if success:
        runner.tokens['parent_single'] = resp['access_token']
        runner.test_data['parent_single_user'] = resp['user']
    
    # ========================================================================
    # SECTION 2: USER MODEL & DATA INTEGRITY
    # ========================================================================
    runner.log("\n📋 SECTION 2: USER MODEL & DATA INTEGRITY", Colors.YELLOW)
    
    # Test 2a: Verify parent has 3 linked children with KNP- admission numbers
    if 'parent_multi_kids' in runner.test_data and len(runner.test_data['parent_multi_kids']) == 3:
        for i, kid_id in enumerate(runner.test_data['parent_multi_kids'][:3]):
            success, resp = runner.test(
                f"Fetch linked child #{i+1} details",
                "GET", f"/students/{kid_id}", 200,
                token=runner.tokens.get('parent_multi'),
                validate_fn=lambda r: r and r.get('admission_number', '').startswith('KNP-')
            )
            if success and i == 0:
                runner.test_data['first_child'] = resp
                runner.log(f"   Child: {resp.get('full_name')} ({resp.get('admission_number')})", Colors.GREEN)
    
    # Test 2b: Get Kanpur school ID first
    kanpur_school_id = None
    if 'kanpur_school_id' not in runner.test_data:
        success, resp = runner.test(
            "Get schools to find Kanpur ID",
            "GET", "/schools", 200,
            token=runner.tokens.get('super_admin')
        )
        if success and resp:
            kanpur = next((s for s in resp if s.get('code') == 'KNP'), None)
            if kanpur:
                runner.test_data['kanpur_school_id'] = kanpur['id']
                kanpur_school_id = kanpur['id']
    else:
        kanpur_school_id = runner.test_data.get('kanpur_school_id')
    
    # Test 2c: Total students count
    success, resp = runner.test(
        "Total students count (should be 375)",
        "GET", "/students", 200,
        token=runner.tokens.get('super_admin'),
        params={"limit": 500, "school_id": kanpur_school_id} if kanpur_school_id else {"limit": 500},
        validate_fn=lambda r: r and len(r) == 375
    )
    if success:
        runner.log(f"   Total students: {len(resp)}", Colors.GREEN)
    
    # Test 2d: Verify Kanpur school details
    if kanpur_school_id:
        runner.log(f"   Kanpur school ID: {kanpur_school_id}", Colors.GREEN)
    
    # Test 2e: Classes count for Kanpur (should be 13)
    if kanpur_school_id:
        success, resp = runner.test(
            "Kanpur classes count (should be 13: LKG-X)",
            "GET", "/classes", 200,
            token=runner.tokens.get('super_admin'),
            params={"school_id": kanpur_school_id},
            validate_fn=lambda r: r and len(r) == 13
        )
        if success:
            runner.log(f"   Classes: {len(resp)}", Colors.GREEN)
            # Verify all have section 'A'
            all_have_section_a = all('A' in c.get('sections', []) for c in resp)
            if all_have_section_a:
                runner.log(f"   ✓ All classes have section 'A'", Colors.GREEN)
    
    # Test 2f: Fee assignments count (should be 375)
    success, resp = runner.test(
        "Fee assignments count (should be 375)",
        "GET", "/fees/assignments", 200,
        token=runner.tokens.get('super_admin'),
        params={"school_id": kanpur_school_id} if kanpur_school_id else {},
        validate_fn=lambda r: r and len(r) == 375
    )
    if success:
        runner.log(f"   Fee assignments: {len(resp)}", Colors.GREEN)
        # Check first assignment has custom_items with Tuition Fee
        if resp and len(resp) > 0:
            first = resp[0]
            has_tuition = any('Tuition' in item.get('fee_head_name', '') 
                            for item in first.get('custom_items', []))
            if has_tuition:
                runner.log("   ✓ Assignments have Tuition Fee items", Colors.GREEN)
            # Check for discounts
            with_discount = [a for a in resp if a.get('discount_amount', 0) > 0]
            runner.log(f"   Students with concession: {len(with_discount)}", Colors.GREEN)
    
    # Test 2g: Payments count (should be > 100)
    success, resp = runner.test(
        "Payments count (should be > 100)",
        "GET", "/payments", 200,
        token=runner.tokens.get('super_admin'),
        params={"limit": 500, "school_id": kanpur_school_id} if kanpur_school_id else {"limit": 500},
        validate_fn=lambda r: r and len(r) > 100
    )
    if success:
        runner.log(f"   Total payments: {len(resp)}", Colors.GREEN)
    
    # Test 2h: Parent users count (should be ~298)
    success, resp = runner.test(
        "Parent users count (should be ~298)",
        "GET", "/users", 200,
        token=runner.tokens.get('super_admin'),
        params={"role": "parent"},
        validate_fn=lambda r: r and 290 <= len(r) <= 300
    )
    if success:
        runner.log(f"   Parent accounts: {len(resp)}", Colors.GREEN)
    
    # Test 2i: Super admin count (should be 1)
    success, resp = runner.test(
        "Super admin count (should be 1)",
        "GET", "/users", 200,
        token=runner.tokens.get('super_admin'),
        params={"role": "super_admin"},
        validate_fn=lambda r: r and len(r) == 1
    )
    
    # Test 2j: Accountant count (should be 1)
    success, resp = runner.test(
        "Accountant count (should be 1)",
        "GET", "/users", 200,
        token=runner.tokens.get('super_admin'),
        params={"role": "accountant"},
        validate_fn=lambda r: r and len(r) == 1
    )
    
    # ========================================================================
    # SECTION 3: PARENT ACCESS CONTROL
    # ========================================================================
    runner.log("\n📋 SECTION 3: PARENT ACCESS CONTROL", Colors.YELLOW)
    
    # Test 3a: Parent can list only their linked children
    success, resp = runner.test(
        "Parent lists students (should see only 3 linked children)",
        "GET", "/students", 200,
        token=runner.tokens.get('parent_multi'),
        validate_fn=lambda r: r and len(r) == 3
    )
    if success:
        runner.log(f"   Parent sees {len(resp)} children (expected 3)", Colors.GREEN)
        runner.test_data['parent_visible_kids'] = [s['id'] for s in resp]
    
    # Test 3b: Parent can access each linked child
    if 'parent_multi_kids' in runner.test_data:
        for i, kid_id in enumerate(runner.test_data['parent_multi_kids']):
            runner.test(
                f"Parent accesses linked child #{i+1}",
                "GET", f"/students/{kid_id}", 200,
                token=runner.tokens.get('parent_multi')
            )
    
    # Test 3c: Parent cannot access unlinked student
    # Get a random student ID that's not linked to this parent
    unlinked_student = None
    success, resp = runner.test(
        "Get all students (as super admin)",
        "GET", "/students", 200,
        token=runner.tokens.get('super_admin'),
        params={"limit": 500}
    )
    if success and resp:
        unlinked_student = next(
            (s for s in resp if s['id'] not in runner.test_data.get('parent_multi_kids', [])),
            None
        )
        if unlinked_student:
            runner.test(
                "Parent tries to access unlinked student (should fail 403)",
                "GET", f"/students/{unlinked_student['id']}", 403,
                token=runner.tokens.get('parent_multi')
            )
    
    # Test 3d: Parent can access fees for linked child
    if 'parent_multi_kids' in runner.test_data and runner.test_data['parent_multi_kids']:
        linked_kid_id = runner.test_data['parent_multi_kids'][0]
        runner.test(
            "Parent accesses fees/dues for linked child",
            "GET", f"/fees/student/{linked_kid_id}/dues", 200,
            token=runner.tokens.get('parent_multi')
        )
    
    # Test 3e: Parent cannot access fees for unlinked child
    if unlinked_student:
        runner.test(
            "Parent tries to access fees for unlinked student (should fail 403)",
            "GET", f"/fees/student/{unlinked_student['id']}/dues", 403,
            token=runner.tokens.get('parent_multi')
        )
    
    # Test 3f: Parent can switch between their children
    if 'parent_multi_kids' in runner.test_data and len(runner.test_data['parent_multi_kids']) >= 3:
        for i, kid_id in enumerate(runner.test_data['parent_multi_kids']):
            runner.test(
                f"Parent switches to child #{i+1}",
                "GET", f"/students/{kid_id}", 200,
                token=runner.tokens.get('parent_multi')
            )
    
    # ========================================================================
    # SECTION 4: USERS PATCH (Admin linking children)
    # ========================================================================
    runner.log("\n📋 SECTION 4: USERS PATCH (Admin Linking Children)", Colors.YELLOW)
    
    # Test 4a: Get a parent user to test PATCH
    success, resp = runner.test(
        "Get parent users list",
        "GET", "/users", 200,
        token=runner.tokens.get('super_admin'),  # Use super_admin for PATCH tests
        params={"role": "parent"}
    )
    if success and resp and len(resp) > 0:
        test_parent = resp[0]
        runner.test_data['test_parent_id'] = test_parent['id']
        original_kids = test_parent.get('linked_student_ids', [])
        runner.log(f"   Test parent: {test_parent.get('full_name')} with {len(original_kids)} kids", Colors.GREEN)
        
        # Test 4b: PATCH to update linked_student_ids
        if 'parent_multi_kids' in runner.test_data and runner.test_data['parent_multi_kids']:
            new_kid_id = runner.test_data['parent_multi_kids'][0]
            success, resp = runner.test(
                "PATCH parent user to update linked_student_ids",
                "PATCH", f"/users/{test_parent['id']}", 200,
                token=runner.tokens.get('super_admin'),  # Use super_admin
                data={"linked_student_ids": [new_kid_id]},
                validate_fn=lambda r: r and new_kid_id in r.get('linked_student_ids', [])
            )
            if success:
                runner.log("   ✓ Successfully updated linked children", Colors.GREEN)
                
                # Test 4c: Verify the change persisted
                runner.test(
                    "Verify PATCH persisted (fetch parent again)",
                    "GET", "/users", 200,
                    token=runner.tokens.get('super_admin'),
                    params={"role": "parent"},
                    validate_fn=lambda r: any(
                        u['id'] == test_parent['id'] and new_kid_id in u.get('linked_student_ids', [])
                        for u in r
                    )
                )
                
                # Restore original state
                runner.test(
                    "Restore original linked_student_ids",
                    "PATCH", f"/users/{test_parent['id']}", 200,
                    token=runner.tokens.get('super_admin'),
                    data={"linked_student_ids": original_kids}
                )
    
    # ========================================================================
    # SECTION 5: REGRESSION TESTS (Analytics & Reports)
    # ========================================================================
    runner.log("\n📋 SECTION 5: REGRESSION TESTS (Analytics & Reports)", Colors.YELLOW)
    
    # Test 5a: Analytics endpoint returns transactions
    success, resp = runner.test(
        "Analytics /api/analytics returns data with months",
        "GET", "/analytics", 200,
        token=runner.tokens.get('accountant'),
        validate_fn=lambda r: r and 'months' in r
    )
    if success:
        runner.log("   ✓ Analytics working", Colors.GREEN)
    
    # Test 5b: Fee status report works
    success, resp = runner.test(
        "Reports /api/reports/collection works",
        "GET", "/reports/collection", 200,
        token=runner.tokens.get('accountant'),
        validate_fn=lambda r: r and 'payments' in r
    )
    if success:
        runner.log("   ✓ Collection report working", Colors.GREEN)
    
    # Test 5c: PDF download endpoint exists
    runner.test(
        "Reports PDF endpoint responds",
        "GET", "/reports/collection.pdf", 200,
        token=runner.tokens.get('accountant')
    )
    
    # Test 5d: CSV download endpoint exists
    runner.test(
        "Reports CSV endpoint responds",
        "GET", "/reports/collection.csv", 200,
        token=runner.tokens.get('accountant')
    )
    
    # Test 5e: XLSX download endpoint exists
    runner.test(
        "Reports XLSX endpoint responds",
        "GET", "/reports/collection.xlsx", 200,
        token=runner.tokens.get('accountant')
    )
    
    # ========================================================================
    # PRINT SUMMARY
    # ========================================================================
    runner.print_summary()
    
    # Return exit code
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
