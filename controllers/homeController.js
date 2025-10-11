const User = require('../models/User');
const Group = require('../models/Group');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode');
const wasender = require('../utils/wasender');
const Excel = require('exceljs');

const jwtSecret = process.env.JWTSECRET;

async function findWasenderSession(centerName) {
  try {
    // Get all sessions to find the one with matching phone number
    const sessionsResponse = await wasender.getAllSessions();
    if (!sessionsResponse.success) {
      throw new Error(`Failed to get sessions: ${sessionsResponse.message}`);
    }
    
    const sessions = sessionsResponse.data;
    let targetSession = null;
    
    // Find session by center name mapping to admin phone numbers
    if (centerName === 'ZHub') {
      targetSession = sessions.find(s => s.phone_number === '+201200077825' || s.phone_number === '01200077825');
    } else if (centerName === 'tagmo3') {
      targetSession = sessions.find(s => s.phone_number === '+201200077823' || s.phone_number === '01200077823');
    } else if (centerName === 'online') {
      targetSession = sessions.find(s => s.phone_number === '+201015783223' || s.phone_number === '01015783223');
    }
    
    // If no specific match, try to find any connected session
    if (!targetSession) {
      targetSession = sessions.find(s => s.status === 'connected');
    }
    
    if (!targetSession) {
      throw new Error('No connected WhatsApp session found');
    }
    
    if (!targetSession.api_key) {
      throw new Error('Session API key not available');
    }
    
    console.log(`Using session: ${targetSession.name} (${targetSession.phone_number}) for center: ${centerName}`);
    return targetSession;
  } catch (err) {
    console.error('Error finding Wasender session:', err.message);
    throw err;
  }
}


async function sendQRCode(chatId, message, studentCode, centerName) {
  try {
    console.log('Sending QR code for center:', centerName);

    // Find the appropriate session for this center
    const targetSession = await findWasenderSession(centerName);
    
    // Format phone number for Wasender API (remove @c.us suffix and add @s.whatsapp.net)
    const phoneNumber = chatId.replace('@c.us', '') + '@s.whatsapp.net';
    console.log('Sending to phone number:', phoneNumber);
    
    // Create a publicly accessible URL for the QR code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(studentCode)}`;
    
    // Send the QR code as an image message
    const mediaResponse = await wasender.sendImageMessage(
      targetSession.api_key,
      phoneNumber,
      qrCodeUrl,
      message
    );

    if (!mediaResponse.success) {
      throw new Error(`Failed to send QR code: ${mediaResponse.message}`);
    }

    console.log('QR code sent successfully:', mediaResponse.data);
    return { success: true };
  } catch (error) {
    console.error('Error sending QR code:', error);
    return { success: false, error: error.message };
  }
}

// Example usage
// sendQRCode('201156012078@c.us', '31313');

const home_page = (req, res) => {
  res.render('index', { title: 'Home Page' });
};

const public_login_get = (req, res) => {
  res.render('login', {
    title: 'Login Page',
    Email: '',
    Password: '',
    error: '',
  });
};

const public_login_post = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [{ phone: emailOrPhone }],
    });

    if (!user) {
      return res.status(401).render('login', {
        title: 'Login Page',
        Email: '',
        Password: null,
        error: 'البريد الالكتروني او كلمه المرور خاطئه',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).render('login', {
        title: 'Login Page',
        Email: '',
        Password: null,
        error: 'البريد الالكتروني او كلمه المرور خاطئه',
      });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret);
    res.cookie('token', token, { httpOnly: true });

    if (user.isTeacher) {
      return res.redirect('/teacher/dash');
    } else {
      if (user.subscribe) {
        return res.redirect('/student/dash');
      } else {
        return res.redirect('/login?StudentCode=' + user.Code);
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).redirect('/login');
  }
};

const public_Register_get = (req, res) => {
  const StudentCode = req.query.StudentCode;

  res.render('Register', {
    title: 'Login Page',
    formData: req.body,
    firebaseError: '',
    StudentCode,
  });
};

// const public_Register_post = async (req, res) => {
//   const {
//     phoneCloumnName,
//     studentPhoneCloumnName,
//     nameCloumnName,
//     CodeCloumn,
//     centerName,
//     Grade,
//     gradeType,
//     groupTime,
//     dataToSend,
//     schoolName,
 
//     // verificationCode,
//   } = req.body;

//   let n = 0;
//   req.io.emit('sendingMessages', {
//     nMessages: n,
//   });

//       dataToSend.forEach(async (student) => {
//         console.log(
//           'student',
//           student[phoneCloumnName],
//           student[studentPhoneCloumnName],
//           student[nameCloumnName],
//           student[CodeCloumn],
//           // student[emailCloumn],
//           // student[schoolCloumn],
//           // student[gradeInNumberCloumn],
//           centerName,
//           Grade,
//           gradeType,
//           groupTime
//         );

//   const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

//     const user = new User({
//       Username: student[nameCloumnName],
//       Password: hashedPassword,
//       passwordWithoutHash: '1qaz2wsx',
//       Code: student[CodeCloumn],
//       phone: student[studentPhoneCloumnName],
//       parentPhone: student[phoneCloumnName],
//       gradeInNumber : '10',
//       school : 'NA',
//       email : 'NA',
//       centerName: centerName,
//       GradeLevel: 'Grade10',
//       Grade: Grade,
//       gradeType: gradeType,
//       groupTime: groupTime,
//       subscribe: false,
//       balance: '100',
//       attendingType: 'NA',
//       bookTaken: false,
//       schoolName: 'NA',
//       isTeacher: false,
//     });
//     console.log('done1');
//     user
//       .save()
//       .then(async (result) => {
//         await Group.findOneAndUpdate(
//           {
//             CenterName: centerName,
//             Grade: Grade,
//             gradeType: gradeType,
//             GroupTime: groupTime,
//           },
//           { $push: { students: result._id } },
//           { new: true, upsert: true }
//         )
//           .then(() => {
//             console.log('done2');
//           })
//       })

// })

// };

const public_Register_post = async (req, res) => {
  const {
    Username,
    Grade,
    phone,
    parentPhone,
    centerName,
    gradeType,
    groupTime,
    balance,
    Code,
    GradeLevel,
    attendingType,
    bookTaken,
    schoolName,
  } = req.body;

  // Create an object to store validation errors
  const errors = {};

  // Check if the phone number has 11 digits
  if (phone.length !== 11) {
    req.body.phone = '';
    errors.phone = '- رقم الهاتف يجب ان يحتوي علي 11 رقم';
  }

  // Check if the parent's phone number has 11 digits
  if (parentPhone.length !== 11) {
    req.body.parentPhone = '';
    errors.parentPhone = '- رقم هاتف ولي الامر يجب ان يحتوي علي 11 رقم';
  }

  // Check if phone is equal to parentPhone
  if (phone === parentPhone) {
    // Clear the phone and parentPhone fields in the form data
    req.body.phone = '';
    req.body.parentPhone = '';

    // Set an error message for this condition
    errors.phone = '- رقم هاتف الطالب لا يجب ان يساوي رقم هاتف ولي الامر';
  }

  if (!Grade) {
    errors.Grade = '- يجب اختيار الصف الدراسي';
  }

  if (!centerName) {
    errors.centerName = '- يجب اختيار اسم center';
  }

  if (!gradeType) {
    errors.gradeType = '- يجب اختيار نوع الصف';
  }

  if (!groupTime) {
    errors.groupTime = '- يجب اختيار وقت المجموعه';
  }

  if (!balance) {
    errors.balance = '- يجب ادخال الرصيد';
  }

  if (!Code) {
    errors.Code = '- يجب ادخال كود الطالب';
  }

  if (!GradeLevel) {
    errors.GradeLevel = '- يجب ادخال المرحله الدراسيه';
  }

  if (!attendingType) {
    errors.attendingType = '- يجب ادخال نوع الحضور';
  }

  if (!schoolName) {
    errors.schoolName = '- يجب ادخال اسم المدرسه';
  }

  // If there are any errors, render the form again with the errors object

  if (Object.keys(errors).length > 0) {
    return res.render('Register', {
      title: 'Register Page',
      errors: errors,
      firebaseError: '',
      formData: req.body, // Pass the form data back to pre-fill the form
    });
  }

  const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

  try {
    const user = new User({
      Username: Username,
      Password: hashedPassword,
      Code: Code,
      phone: phone,
      parentPhone: parentPhone,
      centerName: centerName,
      Grade: Grade,
      gradeType: gradeType,
      groupTime: groupTime,
      GradeLevel: GradeLevel,
      attendingType: attendingType,
      bookTaken: bookTaken,
      schoolName: schoolName,
      balance: balance,
    });
    user
      .save()
      .then(async (result) => {
        await Group.findOneAndUpdate(
          {
            CenterName: centerName,
            Grade: Grade,
            gradeType: gradeType,
            GroupTime: groupTime,
          },
          { $push: { students: result._id } },
          { new: true, upsert: true }
        )
          .then(async () => {
            try {
              console.log("Attempting to send QR code to student...");
              
              // Use the formatted phone with country code
              const qrResult = await sendQRCode(
                `2${phone}@c.us`,
                `This is your QR Code \n\n Student Name: ${Username} \n\n Student Code: ${Code} \n\n Grade: ${Grade} \n\n Grade Level: ${GradeLevel} \n\n Attendance Type: ${attendingType} \n\n Book Taken: ${
                  bookTaken === 'true' ? 'Yes' : 'No'
                } \n\n School: ${schoolName} \n\n Balance: ${balance} \n\n Center Name: ${centerName} \n\n Grade Type: ${gradeType} \n\n Group Time: Group `,
                Code,
                centerName
              );
              
              console.log("QR code sending result:", qrResult);
              
              res
                .status(201)
                .redirect('Register');
            } catch (qrError) {
              console.error("Failed to send QR code:", qrError);
              // Still redirect to Register even if QR code sending fails
              res
                .status(201)
                .redirect('Register');
            }
          })
          .catch((err) => {
            console.log(err);
          });
      })

      .catch((error) => {
        console.log('Error caught:', error);
        if (error.name === 'MongoServerError' && error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0]; // Log the field causing the duplicate
          console.log('Duplicate field:', field); // Log the duplicate field for clarity
          if (field === 'phone') {
            errors.phone = 'هذا الرقم مستخدم من قبل';
          } else {
            errors[field] = `The ${field} is already in use.`;
          }
          res.render('Register', {
            title: 'Register Page',
            errors: errors,
            firebaseError: '',
            formData: req.body,
          });
        } else {
          console.error(error);
          res.status(500).json({ message: 'Internal Server Error' });
        }
      });
  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
      // Duplicate key error
      errors.emailDub = 'This email is already in use.';
      // Handle the error as needed
      res.status(409).json({ message: 'User already in use' });
    } else {
      // Handle other errors
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

const send_verification_code = async (req, res) => {
  try {
    const { phone } = req.body;
    const code = Math.floor(Math.random() * 400000 + 600000);
    const message = `كود التحقق الخاص بك هو ${code}`;

    // Send the message via the waapi (already present)
    await waapi
      .postInstancesIdClientActionSendMessage(
        {
          chatId: `2${phone}@c.us`,
          message: message,
        },
        { id: '22432' }
      )

      .then(({ data }) => {
        // Store the verification code and phone in the session or database
        req.session.verificationCode = code; // Assuming session middleware is used
        req.session.phone = phone;

        // Send a successful response after setting the session
        res.status(201).json({ success: true, data });
      })
      .catch((err) => {
        // Handle any error that occurs during the waapi call
        console.error(err);
        res.status(500).json({ success: false, error: err });
      });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

const forgetPassword_get = (req, res) => {
  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const forgetPassword_post = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({
      $or: [{ phone: phone }],
    });

    if (!user && phone) {
      res.render('forgetPassword', {
        title: 'Forget Password',
        error: 'لا يوجد حساب لهذا الايميل او رقم الهاتف',
        success: null,
      });
      return '';
    } else if (user && phone) {
      const secret = jwtSecret + user.Password;
      const token = jwt.sign({ phone: phone, _id: user._id }, secret, {
        expiresIn: '15m',
      });
      const link = `http://localhost:3000/reset-password/${user._id}/${token}`;

      console.log('aerd', link, postData);

      return '';
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error'); // Handle other errors
  }

  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const reset_password_get = async (req, res) => {
  try {
    const { id, token } = req.params;

    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    const secret = jwtSecret + user.Password;
    const payload = jwt.verify(token, secret);
    res.render('reset-password', { phone: user.phone, error: null });
  } catch (error) {
    res.send(error.message);
  }
};

const reset_password_post = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password1, password2 } = req.body;
    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    if (password1 === password2) {
      const secret = jwtSecret + user.Password;
      const payload = jwt.verify(token, secret);
      const hashedPassword = await bcrypt.hash(password1, 10);
      await User.findByIdAndUpdate({ _id: id }, { Password: hashedPassword })
        .then(() => {
          res.redirect('/login');
        })
        .catch((error) => {
          res.send(error.message);
        });
    } else {
      res.render('reset-password', {
        phone: user.phone,
        error: 'لازم يكونو شبه بعض',
      });
    }
  } catch (error) {
    res.send(error.message);
  }
};

// =================================================== Excel Registration =================================================== //

const registerStudentsFromExcel = async (req, res) => {
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No student data provided'
    });
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const results = [];

  try {
    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      try {
        // Validate required fields
        if (!student.Username || !student.phone || !student.parentPhone || !student.Code) {
          errors.push({
            student: student.Username || 'غير محدد',
            error: 'بيانات ناقصة: يجب إدخال الاسم ورقم الهاتف ورقم هاتف ولي الأمر والكود'
          });
          errorCount++;
          continue;
        }

        // Check if phone number already exists
        const existingPhone = await User.findOne({ phone: student.phone });
        if (existingPhone) {
          errors.push({
            student: student.Username,
            error: `رقم الهاتف ${student.phone} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Check if parent phone number already exists
        const existingParentPhone = await User.findOne({ parentPhone: student.parentPhone });
        if (existingParentPhone) {
          errors.push({
            student: student.Username,
            error: `رقم هاتف ولي الأمر ${student.parentPhone} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Check if code already exists
        const existingCode = await User.findOne({ Code: student.Code });
        if (existingCode) {
          errors.push({
            student: student.Username,
            error: `الكود ${student.Code} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Create new user
        const newUser = new User({
          Username: student.Username,
          phone: student.phone,
          parentPhone: student.parentPhone,
          Code: student.Code,
          centerName: student.centerName,
          Grade: student.Grade,
          gradeType: student.gradeType,
          groupTime: student.groupTime,
          GradeLevel: student.GradeLevel,
          attendingType: student.attendingType,
          bookTaken: student.bookTaken,
          schoolName: student.schoolName,
          balance: student.balance,
          amountRemaining: student.balance, // Initially, amount remaining equals balance
          absences: 0,
          videosInfo: [],
          quizesInfo: [],
          AttendanceHistory: [],
          subscribe: false
        });

        await newUser.save();
        
        // Add to group if group exists
        if (student.centerName && student.Grade && student.gradeType && student.groupTime) {
          let group = await Group.findOne({
            CenterName: student.centerName,
            Grade: student.Grade,
            gradeType: student.gradeType,
            GroupTime: student.groupTime
          });

          if (!group) {
            // Create new group if it doesn't exist
            group = new Group({
              CenterName: student.centerName,
              Grade: student.Grade,
              gradeType: student.gradeType,
              GroupTime: student.groupTime,
              students: []
            });
          }

          if (!group.students.includes(newUser._id)) {
            group.students.push(newUser._id);
            await group.save();
          }
        }

        successCount++;
        results.push({
          student: student.Username,
          code: student.Code,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing student ${student.Username}:`, error);
        errors.push({
          student: student.Username || 'غير محدد',
          error: `خطأ في النظام: ${error.message}`
        });
        errorCount++;
      }
    }

    // Final response
    const response = {
      success: true,
      message: `تم معالجة ${students.length} طالب`,
      successCount,
      errorCount,
      totalProcessed: students.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in bulk registration:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في النظام أثناء معالجة البيانات',
      error: error.message
    });
  }
};

const exportRegistrationErrors = async (req, res) => {
  const { errors } = req.body;
  
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No error data provided for export' 
    });
  }

  try {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Registration Errors');

    // Add title
    const titleRow = worksheet.addRow(['Registration Errors Report']);
    titleRow.font = { size: 16, bold: true };
    worksheet.mergeCells('A1:B1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add timestamp
    worksheet.addRow(['Generated at:', new Date().toLocaleString('ar-EG')]);
    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow(['Student Name', 'Error Message']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' }
    };

    // Add data
    errors.forEach(error => {
      worksheet.addRow([
        error.student || 'غير محدد',
        error.error || 'خطأ غير محدد'
      ]);
    });

    // Set column widths
    worksheet.columns = [
      { key: 'studentName', width: 30 },
      { key: 'errorMessage', width: 50 }
    ];

    // Add borders
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RegistrationErrors_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    res.send(excelBuffer);

  } catch (error) {
    console.error('Error exporting registration errors to Excel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export errors to Excel',
      error: error.message 
    });
  }
};

// =================================================== END Excel Registration =================================================== //

module.exports = {
  home_page,
  public_login_get,
  public_Register_get,
  public_Register_post,
  send_verification_code,
  public_login_post,
  forgetPassword_get,
  forgetPassword_post,
  reset_password_get,
  reset_password_post,
  
  // Excel Registration
  registerStudentsFromExcel,
  exportRegistrationErrors,
};
