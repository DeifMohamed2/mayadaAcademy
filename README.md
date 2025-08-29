# Mayada Academy - Student Registration System

## Excel Upload Feature

The system now supports bulk student registration through Excel file uploads, making it easy to register multiple students at once.

### How to Use Excel Upload

1. **Navigate to Registration Page**: Go to the registration page where you'll see two toggle buttons:
   - إدخال يدوي (Manual Entry)
   - رفع ملف إكسل (Excel Upload)

2. **Switch to Excel Upload**: Click on "رفع ملف إكسل" to access the Excel upload section.

3. **Configure Column Names**: Enter the column names from your Excel file:
   - **عمود اسم الطالب**: Column containing student names
   - **عمود رقم هاتف الطالب**: Column containing student phone numbers
   - **عمود رقم هاتف ولي الأمر**: Column containing parent phone numbers
   - **عمود الكود**: Column containing student codes

4. **Fill Common Fields**: Complete the form fields that will apply to all students:
   - Center Name
   - Grade
   - Grade Type
   - Group Time
   - Grade Level
   - Attending Type
   - Book Taken
   - School Name
   - Balance

5. **Upload Excel File**: 
   - Click on the upload area or drag and drop your Excel file
   - Supported formats: .xlsx, .xls
   - The file should contain the columns you specified above

6. **Download Template**: Use the "تحميل نموذج إكسل" button to get a sample Excel template with the correct format.

7. **Process Registration**: Click "ارسال طلب" to start processing the Excel data.

### Excel File Format

Your Excel file should have the following structure:

| Student Name | Phone | Parent Phone | Code |
|--------------|-------|--------------|------|
| أحمد محمد    | 01234567890 | 01234567891 | 1001 |
| فاطمة علي    | 01234567892 | 01234567893 | 1002 |
| محمد أحمد    | 01234567894 | 01234567895 | 1003 |

### Features

- **Real-time Progress**: See the progress of student registration
- **Error Handling**: Detailed error messages for failed registrations
- **Duplicate Prevention**: Automatically checks for existing phone numbers and codes
- **Error Export**: Download failed registrations as an Excel file for review
- **Drag & Drop**: Easy file upload with drag and drop support
- **Validation**: Ensures all required fields are filled before processing

### Error Types

The system will catch and report the following errors:
- Missing required data
- Duplicate phone numbers
- Duplicate parent phone numbers
- Duplicate student codes
- System errors

### Success Indicators

- **نجح (Success)**: Number of successfully registered students
- **فشل (Failed)**: Number of failed registrations
- **جاري (Processing)**: Current student being processed
- **النسبة (Percentage)**: Overall progress percentage

### Tips for Best Results

1. **Use the Template**: Download and use the provided template to ensure correct formatting
2. **Check Data**: Verify that all phone numbers and codes are unique
3. **Complete Form**: Make sure all common fields are filled before uploading
4. **Review Errors**: Check the error details and fix issues before re-uploading
5. **Backup**: Keep a backup of your original Excel file

### Technical Requirements

- Modern web browser with JavaScript enabled
- Excel files in .xlsx or .xls format
- Stable internet connection for file upload
- All required form fields must be completed

This feature makes it possible to register hundreds of students in minutes instead of hours, significantly improving the efficiency of the registration process.