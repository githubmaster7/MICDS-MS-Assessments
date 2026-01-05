# Testing Guide

## Quick Start

1. **Start the server:**
   ```bash
   python3 -m http.server 8000
   ```
   Or if you prefer Node.js:
   ```bash
   npx http-server -p 8000
   ```

2. **Open your browser:**
   Navigate to: `http://localhost:8000`

## Test Accounts

### Admin
- **Email:** `admin@micds.org`
- **Access:** Admin Panel, All Students view
- **Features:** View system information, see all students

### Teachers
- **Email:** `prosen@micds.org`
- **Email:** `teacher1@micds.org`
- **Email:** `teacher2@micds.org`
- **Access:** All Students view, can grade any student
- **Features:** Select students from dropdown, enter teacher scores and notes

### Students
- **Email:** `student1@micds.org`
- **Email:** `student2@micds.org`
- **Email:** `student3@micds.org`
- **Email:** `alice.smith@micds.org`
- **Email:** `bob.jones@micds.org`
- **Email:** `charlie.brown@micds.org`
- **Access:** Own assessment data only
- **Features:** Enter self-ratings and proofs (requires honor code)

## Testing Checklist

### 1. Login Page
- [ ] Login page displays correctly
- [ ] Can enter email address
- [ ] Email validation works (only @micds.org emails accepted)
- [ ] Error message shows for invalid emails
- [ ] Error message shows for unassigned emails

### 2. Admin Testing
- [ ] Login as `admin@micds.org`
- [ ] Admin Panel tab appears
- [ ] Can see list of teachers and students
- [ ] Can access "All Students" view
- [ ] Logout works

### 3. Teacher Testing
- [ ] Login as `prosen@micds.org` (or any teacher email)
- [ ] See "All Students" tab
- [ ] Student dropdown shows all hardcoded students
- [ ] Can select a student from dropdown
- [ ] Can type username in text field
- [ ] Can click "Load / Create" to load student data
- [ ] Can enter teacher scores and notes
- [ ] Teacher View toggle works
- [ ] Can see all students in "All Students" view
- [ ] Can expand student rows to enter scores
- [ ] Logout works

### 4. Student Testing
- [ ] Login as `student1@micds.org` (or any student email)
- [ ] Student data auto-loads
- [ ] See student email displayed (not load/create controls)
- [ ] See all student tabs (Scores and Grades, Standards 1-4, ATL)
- [ ] Honor code checkbox appears in "Scores and Grades" tab
- [ ] Cannot enter scores without checking honor code
- [ ] Can enter self-ratings after checking honor code
- [ ] Can enter proofs/notes after checking honor code
- [ ] Can see teacher scores (read-only)
- [ ] Cannot edit teacher notes
- [ ] Logout works

### 5. Data Persistence
- [ ] Enter data as student, refresh page, data persists
- [ ] Enter data as teacher, refresh page, data persists
- [ ] Logout and login again, data still there
- [ ] "Save Copy" exports JSON
- [ ] "Load from Copy" imports JSON

### 6. Error Cases
- [ ] Try to login with non-@micds.org email → Error shown
- [ ] Try to login with unassigned email → Error shown
- [ ] Try to enter score without honor code (student) → Alert shown
- [ ] Try to reset student → Confirmation dialog appears

## Common Issues

### Server not running
- Make sure port 8000 is available
- Try a different port: `python3 -m http.server 8080`

### Login page not showing
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Clear sessionStorage: Open browser console and run `sessionStorage.clear()`

### Data not persisting
- Check browser console for errors
- Make sure localStorage is enabled in your browser

## Browser Console Commands

Open browser console (F12) and use these for debugging:

```javascript
// Clear all data
localStorage.clear();
sessionStorage.clear();

// Check current user
sessionStorage.getItem("loggedInUser");

// Check user role
sessionStorage.getItem("userRole");

// View all stored data
JSON.parse(localStorage.getItem("micds_assessment_v1"));

// View admin assignments
JSON.parse(localStorage.getItem("micds_admin_v1"));
```

