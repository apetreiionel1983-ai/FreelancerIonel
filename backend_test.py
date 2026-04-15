#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class WriteGeniusAPITester:
    def __init__(self, base_url="https://ai-differentiator-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.test_user_token = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, cookies=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
            
        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)
                
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Response: {response.text}")
                return False, {}
                
        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}")
            return False, {}
    
    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)
    
    def test_templates_endpoint(self):
        """Test templates endpoint"""
        return self.run_test("Get Templates", "GET", "templates", 200)
    
    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={"email": "admin@writegenius.com", "password": "admin123"}
        )
        if success and 'id' in response:
            self.admin_token = response.get('id')  # Store admin ID for reference
            return True
        return False
    
    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_email = f"test{timestamp}@example.com"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register", 
            200,
            data={
                "email": test_email,
                "password": "test123",
                "name": "Test User"
            }
        )
        if success and 'id' in response:
            self.test_user_token = response.get('id')
            self.test_user_email = test_email
            return True
        return False
    
    def test_user_login(self):
        """Test user login with registered credentials"""
        if not hasattr(self, 'test_user_email'):
            self.log("❌ Cannot test login - no registered user")
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": self.test_user_email, "password": "test123"}
        )
        return success
    
    def test_auth_me(self):
        """Test /auth/me endpoint (requires authentication)"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)
    
    def test_usage_stats(self):
        """Test usage stats endpoint"""
        return self.run_test("Get Usage Stats", "GET", "generation/usage", 200)
    
    def test_generation_history(self):
        """Test generation history endpoint"""
        return self.run_test("Get Generation History", "GET", "generation/history", 200)
    
    def test_content_generation(self):
        """Test AI content generation"""
        success, response = self.run_test(
            "Generate Content",
            "POST",
            "generation/generate",
            200,
            data={
                "template": "social_media",
                "prompt": "Write a test post about AI writing tools",
                "language": "English",
                "tone": "Professional"
            }
        )
        if success and 'content' in response:
            self.log(f"   Generated content: {response['content'][:100]}...")
            return True
        return False
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        return self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@example.com", "password": "wrongpass"}
        )
    
    def test_logout(self):
        """Test logout endpoint"""
        return self.run_test("Logout", "POST", "auth/logout", 200)
    
    def test_unauthenticated_access(self):
        """Test accessing protected endpoints without auth"""
        # Clear session cookies
        self.session.cookies.clear()
        
        success1, _ = self.run_test("Unauth Usage Stats", "GET", "generation/usage", 401)
        success2, _ = self.run_test("Unauth Generation", "POST", "generation/generate", 401, 
                                   data={"template": "email", "prompt": "test"})
        return success1 and success2
    
    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting WriteGenius API Tests")
        self.log(f"Testing against: {self.base_url}")
        
        # Test public endpoints
        self.test_root_endpoint()
        self.test_templates_endpoint()
        
        # Test authentication flow
        if self.test_admin_login():
            self.test_auth_me()
            self.test_usage_stats()
            self.test_generation_history()
            
            # Test content generation with admin (premium user)
            self.test_content_generation()
        
        # Test user registration and login
        if self.test_user_registration():
            self.test_user_login()
            
            # Test content generation with regular user
            self.test_content_generation()
            
            # Test logout
            self.test_logout()
        
        # Test invalid scenarios
        self.test_invalid_login()
        self.test_unauthenticated_access()
        
        # Print results
        self.log(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!")
            return 0
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = WriteGeniusAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())