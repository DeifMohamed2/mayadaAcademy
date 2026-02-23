const User = require('../models/User');
const Group = require('../models/Group');
const Card = require('../models/Card');
const Attendance = require('../models/Attendance');

const { 
  sendAttendanceNotification, 
  sendNotificationMessage,
  sendLocalizedAttendanceNotification,
  sendLocalizedHomeworkNotification,
  sendLocalizedQuizNotification,
  getUserLanguage,
  getHomeworkStatusLine,
  getHomeworkStatusLabel,
} = require('../utils/notificationSender');
const Excel = require('exceljs');
const QRCode = require('qrcode');

// Helper function to validate and format phone numbers
function validateAndFormatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required and must be a string');
  }

  // Remove any non-numeric characters
  let cleanPhone = phone.replace(/\D/g, '');

  // Check if we have any digits
  if (cleanPhone.length === 0) {
    throw new Error('Phone number contains no digits');
  }

  // Check for invalid patterns (all zeros, all ones, etc.)
  if (/^0+$/.test(cleanPhone) || /^1+$/.test(cleanPhone)) {
    throw new Error('Phone number contains only repeated digits');
  }

  // Handle different input formats for Egyptian numbers
  if (
    cleanPhone.length === 11 &&
    cleanPhone.startsWith('0') &&
    cleanPhone.charAt(1) === '1'
  ) {
    // Egyptian mobile format (01xxxxxxxxx) -> convert to international (20xxxxxxxxxx)
    return '20' + cleanPhone.substring(1);
  } else if (
    cleanPhone.startsWith('20') &&
    cleanPhone.length === 12 &&
    cleanPhone.charAt(2) === '1'
  ) {
    // Already in Egyptian international format (20xxxxxxxxxx)
    return cleanPhone;
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('1')) {
    // Egyptian local format without 0 (1xxxxxxxxx) -> convert to international (201xxxxxxxxx)
    return '20' + cleanPhone;
  } else {
    // For non-Egyptian numbers or other formats, return as is without modification
    console.log(
      `Non-Egyptian number detected: ${cleanPhone} - using without country code modification`,
    );
    return cleanPhone;
  }
}

const dash_get = async (req, res) => {
  res.render('teacher/dash', { title: 'DashBoard', path: req.path });
};

const myStudent_get = (req, res) => {
  res.render('teacher/myStudent', {
    title: 'Mystudent',
    path: req.path,
    userData: null,
    attendance: null,
  });
};

// =================================================== Student Requests ================================================ //

let query;
const studentsRequests_get = async (req, res) => {
  try {
    const {
      centerName,
      Grade,
      gradeType,
      groupTime,
      attendingType,
      GradeLevel,
      page = 1,
    } = req.query;

    // Build the query dynamically
    query = { centerName, Grade, gradeType, groupTime };
    if (attendingType) query.attendingType = attendingType;
    if (GradeLevel) query.GradeLevel = GradeLevel;

    // Pagination variables
    const perPage = 500;

    // Execute the query with pagination
    const [result, count] = await Promise.all([
      User.find(query, {
        Username: 1,
        Code: 1,
        balance: 1,
        amountRemaining: 1,
        createdAt: 1,
        updatedAt: 1,
      })
        .sort({ subscribe: 1, createdAt: 1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .exec(),
      User.countDocuments(query),
    ]);

    // Calculate pagination details
    const nextPage = parseInt(page) + 1;
    const hasNextPage = nextPage <= Math.ceil(count / perPage);
    const hasPreviousPage = page > 1;

    // Render the response
    res.render('teacher/studentsRequests', {
      title: 'StudentsRequests',
      path: req.path,
      modalData: null,
      modalDelete: null,
      studentsRequests: result,
      Grade,
      isSearching: false,
      nextPage: hasNextPage ? nextPage : null,
      previousPage: hasPreviousPage ? page - 1 : null,
    });
  } catch (error) {
    console.error('Error in studentsRequests_get:', error);
    res.status(500).send('Internal Server Error');
  }
};

const searchForUser = async (req, res) => {
  const { searchBy, searchInput } = req.body;
  try {
    await User.find(
      { [`${searchBy}`]: searchInput },
      {
        Username: 1,
        Code: 1,
        createdAt: 1,
        updatedAt: 1,
        subscribe: 1,
        balance: 1,
        amountRemaining: 1,
      },
    ).then((result) => {
      res.render('teacher/studentsRequests', {
        title: 'StudentsRequests',
        path: req.path,
        modalData: null,
        modalDelete: null,
        studentsRequests: result,
        studentPlace: query.place || 'All',
        Grade: query.Grade,
        isSearching: true,
        nextPage: null,
        previousPage: null, // Calculate previous page
      });
    });
  } catch (error) {}
};

const converStudentRequestsToExcel = async (req, res) => {
  try {
    // Fetch user data with only the required fields
    const users = await User.find(query, {
      Username: 1,
      Code: 1,
      phone: 1,
      parentPhone: 1,
      schoolName: 1,
      absences: 1,
    });

    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Students Data');

    // Add headers with proper spacing
    const headerRow = worksheet.addRow([
      'User Name',
      'Student Code',
      'School Name',
      'Phone Number',
      'Parent Phone Number',
      'Absences',
    ]);

    // Style headers - bold text only, no colors
    headerRow.font = { bold: true, size: 12 };

    // Set column widths for better spacing
    worksheet.columns = [
      { key: 'Username', width: 25 },
      { key: 'Code', width: 15 },
      { key: 'schoolName', width: 30 },
      { key: 'phone', width: 20 },
      { key: 'parentPhone', width: 20 },
      { key: 'absences', width: 15 },
    ];

    // Add user data to the worksheet - no colors, simple formatting
    users.forEach((user) => {
      const row = worksheet.addRow([
        user.Username || '',
        user.Code || '',
        user.schoolName || '',
        user.phone || '',
        user.parentPhone || '',
        user.absences || 0,
      ]);

      // Simple formatting - no colors, just clean data
      row.font = { size: 11 };
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="StudentsData.xlsx"`,
    );

    // Send Excel file as response
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('An error occurred while generating Excel file.');
  }
};

const getSingleUserAllData = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    console.log(studentID);
    await User.findOne({ _id: studentID })
      .then((result) => {
        res.status(200).send(result);
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    console.log(error);
  }
};

const updateUserData = async (req, res) => {
  try {
    const {
      Username,
      phone,
      parentPhone,
      balance,

      absences,
      amountRemaining,
      GradeLevel,
      attendingType,
      bookTaken,
      schoolName,
    } = req.body;
    const { studentID } = req.params;

    // Validate required fields
    if (!studentID) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    // Build the update object dynamically
    const updateFields = {};
    if (Username) updateFields.Username = Username;
    if (phone) updateFields.phone = phone;
    if (parentPhone) updateFields.parentPhone = parentPhone;
    if (balance !== undefined) updateFields.balance = balance;
    if (amountRemaining !== undefined)
      updateFields.amountRemaining = amountRemaining;
    if (GradeLevel) updateFields.GradeLevel = GradeLevel;
    if (attendingType) updateFields.attendingType = attendingType;
    if (bookTaken !== undefined) updateFields.bookTaken = bookTaken === 'true';
    if (schoolName) updateFields.schoolName = schoolName;
    if (absences) updateFields.absences = absences;

    // Optional fields with additional checks
    // if (centerName) updateFields.centerName = centerName;
    // if (Grade) updateFields.Grade = Grade;
    // if (gradeType) updateFields.gradeType = gradeType;
    // if (groupTime) updateFields.groupTime = groupTime;

    // Get the current user data to compare changes
    const currentUser = await User.findById(studentID);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update the student document
    const updatedUser = await User.findByIdAndUpdate(studentID, updateFields, {
      new: true,
    });

    // Check if bookTaken status was changed and send notification
    const newBookTakenValue = bookTaken === 'true';
    if (
      bookTaken !== undefined &&
      newBookTakenValue !== currentUser.bookTaken
    ) {
      try {
        console.log(
          `Book taken status changed for ${updatedUser.Username} from ${currentUser.bookTaken} to ${newBookTakenValue}`,
        );

        const bookStatusMessage = `📚 تحديث حالة الكتاب\n\nالطالب: ${updatedUser.Username}\nالكود: ${updatedUser.Code}\n\nحالة الكتاب: ${newBookTakenValue ? 'تم استلام الكتاب ✅' : 'لم يتم استلام الكتاب ❌'}\n\nتاريخ التحديث: ${new Date().toLocaleDateString('ar-EG')}`;

        // Send notification to student's phone
        const studentPhone = updatedUser.phone;
        await sendNotificationMessage(studentPhone, bookStatusMessage, {
          studentName: updatedUser.Username,
          studentCode: updatedUser.Code,
          type: 'book_status',
        });
        console.log(
          `Book status notification sent successfully to ${updatedUser.Username}`,
        );

        // Also send to parent's phone if different from student's phone
        if (
          updatedUser.parentPhone &&
          updatedUser.parentPhone !== studentPhone
        ) {
          const parentMessage = `📚 تحديث حالة الكتاب لطفلك\n\nالطالب: ${updatedUser.Username}\nالكود: ${updatedUser.Code}\n\nحالة الكتاب: ${newBookTakenValue ? 'تم استلام الكتاب ✅' : 'لم يتم استلام الكتاب ❌'}\n\nتاريخ التحديث: ${new Date().toLocaleDateString('ar-EG')}`;
          await sendNotificationMessage(
            updatedUser.parentPhone,
            parentMessage,
            {
              studentName: updatedUser.Username,
              studentCode: updatedUser.Code,
              type: 'book_status',
            },
          );
          console.log(
            `Book status notification sent to parent of ${updatedUser.Username}`,
          );
        }
      } catch (notificationError) {
        console.error(
          'Failed to send book status notification:',
          notificationError.message,
        );
        // Don't fail the update if notification fails
      }
    }

    // Handle group update only if centerName is provided
    // if (centerName) {
    //   console.log('Updating group data...');
    //   // Remove the student from any previous group
    //   await Group.updateMany(
    //     { students: updatedUser._id },
    //     { $pull: { students: updatedUser._id } }
    //   );

    //   // Find the new group
    //   const newGroup = await Group.findOne({
    //     CenterName: centerName,
    //     Grade,
    //     gradeType,
    //     GroupTime: groupTime,
    //   });

    //   if (!newGroup) {
    //     return res.status(404).json({ error: 'Target group not found.' });
    //   }

    //   // Add the student to the new group
    //   if (!newGroup.students.includes(updatedUser._id)) {
    //     newGroup.students.push(updatedUser._id);
    //     await newGroup.save();
    //   }
    // }

    // Redirect or send a success response
    return res
      .status(200)
      .json({ message: 'User data updated successfully.', updatedUser });
  } catch (error) {
    console.error('Error updating user data:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// const confirmDeleteStudent = async (req, res) => {
//   try {
//     const studentID = req.params.studentID;
//     res.render('teacher/studentsRequests', {
//       title: 'StudentsRequests',
//       path: req.path,
//       modalData: null,
//       modalDelete: studentID,
//       studentsRequests: null,
//       studentPlace: query.place || 'All',
//       Grade: query.Grade,
//       isSearching: false,
//       nextPage: null,
//       previousPage: null, // Calculate previous page
//     });
//   } catch (error) {}
// };

const DeleteStudent = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    if (!studentID) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (
      studentID == '668138aeebc1138a4277c47a' ||
      studentID == '668138edebc1138a4277c47c' ||
      studentID == '66813909ebc1138a4277c47e'
    ) {
      return res.status(400).json({ error: 'You can not delete this user' });
    }

    await Group.updateMany(
      { students: studentID },
      { $pull: { students: studentID } },
    ).then(async (result) => {
      await User.findByIdAndDelete(studentID).then((result) => {
        return res
          .status(200)
          .json({ message: 'User deleted successfully.', result });
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
// =================================================== END Student Requests ================================================ //

// ===================================================  MyStudent ================================================ //

const searchToGetOneUserAllData = async (req, res) => {
  const { searchBy, searchInput } = req.query;

  try {
    const result = await User.findOne({ [`${searchBy}`]: searchInput });

    const attendance = await Card.findOne({ userId: result._id });

    res.render('teacher/myStudent', {
      title: 'Mystudent',
      path: req.path,
      userData: result,
      attendance: attendance.cardHistory,
    });
  } catch (error) {}
};

const convertToExcelAllUserData = async (req, res) => {
  const { studetCode } = req.params;
  console.log(studetCode);
  try {
    await User.findOne({ Code: +studetCode })
      .then(async (user) => {
        // Create a new Excel workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');
        const Header = worksheet.addRow([`بيانات الطالب ${user.Username} `]);
        Header.getCell(1).alignment = { horizontal: 'center' }; // Center align the text
        Header.font = { bold: true, size: 16 };
        Header.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
        worksheet.mergeCells('A1:H1');
        worksheet.addRow();
        const headerRowUserBasicInfo = worksheet.addRow([
          'اسم الطالب',
          'كود الطالب ',
          'رقم هاتف الطالب',
          'رقم هاتف ولي الامر',
        ]);
        headerRowUserBasicInfo.font = { bold: true };
        headerRowUserBasicInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF00' },
        };

        // Add user data to the worksheet with alternating row colors

        const rowUserBasicInfo = worksheet.addRow([
          user.Username,
          user.Code,
          user.phone,
          user.parentPhone,
        ]);
        rowUserBasicInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };

        const headerRowUserVideoInfo = worksheet.addRow([
          '#',
          'اسم الفيديو',
          'عدد مرات المشاهده',
          'عدد المشاهدات المتبقيه ',
          'تاريخ اول مشاهده ',
          'تاريخ اخر مشاهده ',
          'رفع الواجب ',
          'حل الامتحان ',
          'حاله الشراء ',
        ]);
        headerRowUserVideoInfo.font = { bold: true };
        headerRowUserVideoInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '9fea0c' },
        };
        let c = 0;

        user['videosInfo'].forEach((data) => {
          c++;
          let homeWork, Exam;
          if (data.prerequisites == 'WithOutExamAndHW') {
            homeWork = 'لا يوجد';
            Exam = 'لا يوجد';
          } else if (data.prerequisites == 'WithExamaAndHw') {
            homeWork = data.isHWIsUploaded ? 'تم الرفع' : 'لم يُرفع';
            Exam = data.isUserEnterQuiz ? 'تم الدخول' : 'لم يدخل';
          } else if (data.prerequisites == 'WithHw') {
            homeWork = data.isHWIsUploaded ? 'تم الرفع' : 'لم يُرفع';
          } else {
            Exam = data.isUserEnterQuiz ? 'تم الدخول' : 'لم يدخل';
          }

          const headerRowUserVideoInfo = worksheet.addRow([
            c,
            data.videoName,
            data.numberOfWatches,
            data.videoAllowedAttemps,
            new Date(data.fristWatch).toLocaleDateString() || 'لم يشاهد بعد',
            new Date(data.lastWatch).toLocaleDateString() || 'لم يشاهد بعد',
            homeWork,
            Exam,
            data.isVideoPrepaid
              ? data.videoPurchaseStatus
                ? 'تم الشراء'
                : 'لم يتم الشراء'
              : 'الفيديو مجاني',
          ]);

          if (c % 2 === 0) {
            headerRowUserVideoInfo.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'DDDDDD' },
            };
          }
        });
        const headerRowUserQuizInfo = worksheet.addRow([
          '#',
          'اسم الامتحان',
          'تاريخ الحل ',
          'مده الحل ',
          ' درجه الامتحان ',
          'حاله الشراء ',
        ]);
        headerRowUserQuizInfo.font = { bold: true };
        headerRowUserQuizInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '10a1c2' },
        };

        let cq = 0;
        user['quizesInfo'].forEach((data) => {
          cq++;
          const headerRowUserQuizInfo = worksheet.addRow([
            cq,
            data.quizName,
            new Date(data.solvedAt).toLocaleDateString() || 'لم يحل',
            data.solveTime || 'لم يحل',
            data.questionsCount + '/' + data.Score,
            data.isQuizPrepaid
              ? data.quizPurchaseStatus
                ? 'تم الشراء'
                : 'لم يتم الشراء'
              : 'الامتحان مجاني',
          ]);
          if (cq % 2 === 0) {
            headerRowUserQuizInfo.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'DDDDDD' },
            };
          }
        });

        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Set response headers for file download
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=users_data.xlsx',
        );

        // Send Excel file as response
        res.send(excelBuffer);
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    console.log(error);
  }
};

// =================================================== END MyStudent ================================================ //

const addCardGet = async (req, res) => {
  res.render('teacher/addCard', { title: 'addCard', path: req.path });
};

const addCardToStudent = async (req, res) => {
  const { studentCode, assignedCard } = req.body;

  // Check for missing fields
  if (!studentCode || !assignedCard) {
    return res
      .status(400)
      .json({
        message: 'studentCode and assignedCard are required',
        Username: null,
      });
  }

  try {
    const userByCode = await User.findOne(
      { Code: studentCode },
      { cardId: 1, Username: 1, Code: 1 },
    );
    const userHasCard = await User.findOne({ cardId: assignedCard });
    if (!userByCode) {
      return res
        .status(400)
        .json({
          message: 'This student does not exist, please verify the code',
          Username: '',
        });
    }

    if (userByCode.cardId) {
      return res
        .status(400)
        .json({
          message: 'This student already has a card.',
          Username: userByCode.Username,
        });
    }

    if (userHasCard) {
      return res
        .status(400)
        .json({
          message: 'This card has already been used.',
          Username: `Used by ${userHasCard.Username}`,
        });
    }

    await User.updateOne(
      { Code: studentCode },
      {
        cardId: assignedCard,
      },
    )
      .then((result) => {
        return res
          .status(200)
          .json({
            message: 'تم اضافه الكارت للطالب بنجاح',
            Username: userByCode.Username,
          });
      })
      .catch((err) => {
        console.error(err);
        return res
          .status(500)
          .json({ message: 'يبدو ان هناك خطأ ما ', Username: null });
      });
  } catch (error) {
    console.error('Error adding card:', error);
    return res
      .status(500)
      .json({ message: 'يبدو ان هناك خطأ ما ', Username: null });
  }
};

const markAttendance = async (req, res) => {
  const {
    Grade,
    centerName,
    GroupTime,
    attendId,
    gradeType,
    attendAbsencet,
    attendOtherGroup,
    attendWithoutHW,
    // HWwithOutSteps,
    // attendWithOutHW,
  } = req.body;

  try {
    const student = await User.findOne({
      $or: [{ cardId: attendId }, { Code: +attendId }],
    });

    if (!student) {
      return res.status(404).json({ message: 'Student Not found' });
    }

    let HWmessage = '';
    // if(attendWithOutHW){
    //   HWmessage = '*تم تسجيل حضور الطالب بدون واجب*';
    // }else if(HWwithOutSteps){
    //   HWmessage = '*لقد قام الطالب بحل الواجب لكن بدون خطوات*';
    // }else{
    //   HWmessage = '*لقد قام الطالب بحل الواجب بالخطوات*';
    // }

    console.log(student._id);
    // Check if student is in the group
    let group = null;
    if (!attendOtherGroup) {
      group = await Group.findOne({
        CenterName: centerName,
        Grade: Grade,
        GroupTime: GroupTime,
        gradeType: gradeType,
        students: student._id,
      });
    } else {
      group = await Group.findOne({
        CenterName: centerName,
        Grade: Grade,
        GroupTime: GroupTime,
        gradeType: gradeType,
      });
    }

    if (!group) {
      return res
        .status(404)
        .json({ message: 'Student Not Found in This Group' });
    }

    let message = '';
    if (student.absences >= 3) {
      if (attendAbsencet) {
        student.absences -= 1;
      } else {
        return res.status(400).json({
          message: 'Student has already been marked absent 3 times',
        });
      }
    }

    // Mark student as present in today's attendance
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());

    let attendance = await Attendance.findOne({
      date: today,
      groupId: group._id,
    });

    if (!attendance) {
      attendance = new Attendance({
        date: today,
        groupId: group._id,
        studentsPresent: [],
        studentsAbsent: [],
        studentsLate: [],
        isFinalized: false,
      });
    }

    // Check if student is already marked as present
    if (attendance.studentsPresent.includes(student._id)) {
      return res
        .status(400)
        .json({ message: 'Student is already marked present' });
    }
    // Check if student is already marked as Late
    if (attendance.studentsLate.includes(student._id)) {
      return res
        .status(400)
        .json({ message: 'Student is already marked Late' });
    }
    if (attendance.studentsExcused.includes(student._id)) {
      return res.status(400).json({
        message: 'Student is already marked present From Other Group',
      });
    }

    // Handle if attendance is finalized (late marking logic)
    if (attendance.isFinalized) {
      attendance.studentsAbsent = attendance.studentsAbsent.filter(
        (id) => !id.equals(student._id),
      );
      attendance.studentsLate.push(student._id);

      if (student.absences > 0) {
        student.absences -= 1;
      }

      await attendance.save();

      // Determine homework status for late attendance (default is done)
      let lateHomeworkStatus = attendWithoutHW ? 'not_done' : 'done';

      // Find if an attendance history already exists for today
      const existingHistory = student.AttendanceHistory.find(
        (record) => record.date === today,
      );

      if (existingHistory) {
        // Update the status to 'Late' if an entry already exists
        existingHistory.status = 'Late';
        existingHistory.atTime = new Date().toLocaleTimeString();
        existingHistory.homeworkStatus = lateHomeworkStatus;
        existingHistory.ignoredAbsencePolicy = !!attendAbsencet;
        existingHistory.fromOtherGroup = !!attendOtherGroup;
        existingHistory.groupInfo = {
          centerName: centerName,
          grade: Grade,
          gradeType: gradeType,
          groupTime: GroupTime,
        };
        existingHistory.amountPaid = student.balance || 0;
        existingHistory.amountRemaining = student.amountRemaining || 0;

        // Mark AttendanceHistory as modified to ensure Mongoose updates it
        student.markModified('AttendanceHistory');
      } else {
        // Push a new history entry if it doesn't exist for today
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Late',
          homeworkStatus: lateHomeworkStatus,
          ignoredAbsencePolicy: !!attendAbsencet,
          fromOtherGroup: !!attendOtherGroup,
          groupInfo: {
            centerName: centerName,
            grade: Grade,
            gradeType: gradeType,
            groupTime: GroupTime,
          },
          amountPaid: student.balance || 0,
          amountRemaining: student.amountRemaining || 0,
        });
      }

      // Save with validation disabled to avoid required field errors
      try {
        await student.save({ validateBeforeSave: false });
      } catch (saveError) {
        console.warn(
          `Error saving student ${student.Username} (ID: ${student._id}):`,
          saveError.message,
        );
        // Continue with attendance marking even if student save fails
      }

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');

      // Send notification to parent
      try {
        // Check if parent phone exists
        if (!student.parentPhone) {
          console.log(
            `Warning: No parent phone for student ${student.Username} (ID: ${student._id})`,
          );
        } else {
          console.log(
            `Sending notification to parent phone: ${student.parentPhone} for student: ${student.Username}`,
          );
          await sendLocalizedAttendanceNotification(
            student.parentPhone,
            'late',
            {
              type: 'attendance_late',
              studentName: student.Username,
              studentCode: student.Code,
              group: `${centerName} - ${Grade} - ${GroupTime}`,
              absences: student.absences,
              date: today,
            }
          );
          console.log('Notification sent successfully for late attendance');
        }
      } catch (notificationError) {
        console.error(
          'Notification error for late attendance:',
          notificationError.message,
        );
        // Continue with attendance marking even if notification fails
        // The attendance is already saved, so we don't want to fail the entire operation
      }

      return res.status(200).json({
        message: 'The Student Marked As Late \n' + message,
        studentsPresent: attendance.studentsPresent,
        studentsLate: attendance.studentsLate,
        studentsExcused: attendance.studentsExcused,
      });
    } else {
      let message = '';
      if (student.absences == 2) {
        message = 'The student has 2 absences and 1 remaining';
      }
      // // Check if student is already marked absent 3 times
      // if (student.absences >= 3) {
      //   return res
      //     .status(400)
      //     .json({
      //       message: 'Student has already been marked absent 3 times',
      //     });
      // }
      let statusMessage = '';
      if (attendOtherGroup) {
        attendance.studentsExcused.push(student._id);
        statusMessage = 'Present From Other Group';
      } else {
        attendance.studentsPresent.push(student._id);
        statusMessage = 'Present';
      }

      await attendance.save();

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');
      console.log(attendance.studentsExcused);

      // Determine homework status (default is done)
      let homeworkStatus = 'done';
      if (attendWithoutHW) {
        homeworkStatus = 'not_done';
      }

      // Save attendance history with all details
      student.AttendanceHistory.push({
        attendance: attendance._id,
        date: today,
        atTime: new Date().toLocaleTimeString(),
        status: attendOtherGroup ? 'Present From Other Group' : 'Present',
        homeworkStatus: homeworkStatus,
        ignoredAbsencePolicy: !!attendAbsencet,
        fromOtherGroup: !!attendOtherGroup,
        groupInfo: {
          centerName: centerName,
          grade: Grade,
          gradeType: gradeType,
          groupTime: GroupTime,
        },
        amountPaid: student.balance || 0,
        amountRemaining: student.amountRemaining || 0,
      });

      // Send notification to parent
      try {
        // Check if parent phone exists
        if (!student.parentPhone) {
          console.log(
            `Warning: No parent phone for student ${student.Username} (ID: ${student._id})`,
          );
        } else {
          console.log(
            `Sending notification to parent phone: ${student.parentPhone} for student: ${student.Username}`,
          );
          // Get user's language preference for homework line
          const userLang = await getUserLanguage(student.parentPhone);
          const hwLine = getHomeworkStatusLine(homeworkStatus, userLang);
          
          await sendLocalizedAttendanceNotification(
            student.parentPhone,
            'present',
            {
              type: 'attendance_present',
              studentName: student.Username,
              studentCode: student.Code,
              group: `${centerName} - ${Grade} - ${GroupTime}`,
              absences: student.absences,
              hwLine: hwLine,
              date: today,
            }
          );
          console.log('Notification sent successfully');
        }
      } catch (notificationError) {
        console.error('Notification error:', notificationError.message);
        // Continue with attendance marking even if notification fails
        // The attendance is already saved, so we don't want to fail the entire operation
      }

      // Save with validation disabled to avoid required field errors
      try {
        await student.save({ validateBeforeSave: false });
      } catch (saveError) {
        console.warn(
          `Error saving student ${student.Username} (ID: ${student._id}):`,
          saveError.message,
        );
        // Continue with attendance marking even if student save fails
      }
      return res.status(200).json({
        message:
          `Attendance marked successfully as ${statusMessage}  \n` + message,
        studentsPresent: attendance.studentsPresent,
        studentsLate: attendance.studentsLate,
        studentsExcused: attendance.studentsExcused,
      });
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const getAttendedUsers = async (req, res) => {
  const { Grade, centerName, GroupTime, attendId, gradeType } = req.body;
  const group = await Group.findOne({
    CenterName: centerName,
    Grade: Grade,
    gradeType: gradeType,
    GroupTime: GroupTime,
  });

  if (!group) {
    return res.status(404).json({
      message: 'There are currently no students registered in this group',
    });
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', // Egypt's time zone
  }).format(new Date());

  console.log(today); // Should give you the correct date in 'YYYY-MM-DD' format

  const attendance = await Attendance.findOne({
    groupId: group._id,
    date: today,
  }).populate('studentsPresent studentsLate studentsExcused');
  console.log(attendance);
  if (!attendance) {
    return res
      .status(404)
      .json({ message: 'Attendance records have not been submitted yet' });
  }

  return res.status(200).json({ attendance });
};

const removeAttendance = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType } = req.body;
  const studentId = req.params.studentId;

  try {
    // Fetch the student
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the group the student belongs to
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      GroupTime: GroupTime,
      gradeType: gradeType,
      students: student._id, // Ensure the student is part of this group
    });

    if (!group) {
      return res
        .status(404)
        .json({ message: 'Student not found in this group' });
    }

    // Find today's attendance for the group
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());
    const attendance = await Attendance.findOne({
      date: today,
      groupId: group._id,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    // Check if the student is in the present or late lists
    const isPresent = attendance.studentsPresent.some((id) =>
      id.equals(student._id),
    );
    const isLate = attendance.studentsLate.some((id) => id.equals(student._id));

    if (!isPresent && !isLate) {
      return res
        .status(400)
        .json({ message: 'Student is not marked as present or late today' });
    }

    // Remove the student from studentsPresent if present
    if (isPresent) {
      attendance.studentsPresent = attendance.studentsPresent.filter(
        (id) => !id.equals(student._id),
      );
    }

    // Remove the student from studentsLate if late
    if (isLate) {
      attendance.studentsLate = attendance.studentsLate.filter(
        (id) => !id.equals(student._id),
      );
    }

    // // Optionally, add the student to studentsAbsent if not already there
    // if (!attendance.studentsAbsent.includes(student._id)) {
    //   attendance.studentsAbsent.push(student._id);
    // }

    // Save the updated attendance record
    await attendance.save();

    // Remove the attendance record from the student's history
    student.AttendanceHistory = student.AttendanceHistory.filter(
      (att) => !att.attendance.equals(attendance._id), // Use .equals() for ObjectId comparison
    );

    // Save with validation disabled to avoid required field errors
    try {
      await student.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.warn(
        `Error saving student ${student.Username} (ID: ${student._id}):`,
        saveError.message,
      );
      // Continue with attendance removal even if student save fails
    }
    return res.status(200).json({
      message: 'Attendance removed successfully',
      studentsPresent: attendance.studentsPresent,
      studentsLate: attendance.studentsLate,
      studentsAbsent: attendance.studentsAbsent,
    });
  } catch (error) {
    console.error('Error removing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateAmount = async (req, res) => {
  const amountRemaining = req.body.amountRemaining || 0;
  const studentId = req.params.studentId;

  try {
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.amountRemaining = amountRemaining;
    // Save with validation disabled to avoid required field errors
    try {
      await student.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.warn(
        `Error saving student ${student.Username} (ID: ${student._id}):`,
        saveError.message,
      );
      return res.status(500).json({ message: 'Error updating student data' });
    }

    return res.status(200).json({ message: 'Amount updated successfully' });
  } catch (error) {
    console.error('Error updating amount:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const finalizeAttendance = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType } = req.body;

  try {
    // Find the group
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      gradeType: gradeType,
      GroupTime: GroupTime,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Find today's attendance record for the group
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());

    let attendance = await Attendance.findOne({
      groupId: group._id,
      date: today,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    if (attendance.isFinalized) {
      return res.status(400).json({ message: 'Attendance already finalized' });
    }

    const groupStudentIds = group.students;

    for (const studentId of groupStudentIds) {
      const isPresent = attendance.studentsPresent.some((id) =>
        id.equals(studentId),
      );
      const isLate = attendance.studentsLate.some((id) => id.equals(studentId));

      console.log(isPresent, isLate);
      if (!isPresent && !isLate) {
        if (!attendance.studentsAbsent.includes(studentId)) {
          attendance.studentsAbsent.push(studentId);

          const student = await User.findById(studentId);

          if (student) {
            student.absences = (student.absences || 0) + 1;
            student.AttendanceHistory.push({
              attendance: attendance._id,
              date: today,
              atTime: new Date().toLocaleTimeString(),
              status: 'Absent',
              homeworkStatus: 'not_specified',
              ignoredAbsencePolicy: false,
              fromOtherGroup: false,
              groupInfo: {
                centerName: centerName,
                grade: Grade,
                gradeType: gradeType,
                groupTime: GroupTime,
              },
            });

            // Save with validation disabled to avoid required field errors
            try {
              await student.save({ validateBeforeSave: false });
            } catch (saveError) {
              console.warn(
                `Error saving student ${student.Username} (ID: ${student._id}):`,
                saveError.message,
              );
              // Continue with other students even if one fails to save
            }
          }
        }
      }
    }

    attendance.isFinalized = true;
    await attendance.save();
    await attendance.populate('studentsAbsent');
    await attendance.populate('studentsPresent');
    await attendance.populate('studentsExcused');

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);
    titleRow.font = { size: 27, bold: true };
    worksheet.mergeCells('A1:H1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add group info
    const groupInfoRow = worksheet.addRow([
      'Grade',
      'Center Name',
      'Group Time',
      'Date',
    ]);
    groupInfoRow.font = { bold: true };

    worksheet.addRow([Grade, centerName, GroupTime, today]);

    // Add present students section
    let row = worksheet.addRow([]);
    row = worksheet.addRow(['Present Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c = 0;
    let totalAmount = 0;
    let totalAmountRemaining = 0;

    attendance.studentsPresent.forEach(async (student) => {
      c++;
      const row = worksheet.addRow([
        c,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount += student.balance;
      totalAmountRemaining += student.amountRemaining;

      if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add total row for Present Students
    const totalRowPresent = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount,
      totalAmountRemaining,
    ]);
    totalRowPresent.font = { bold: true };
    totalRowPresent.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add present Other Group students section
    row = worksheet.addRow(['Present From Other Group Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow3 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
      'Group Info',
    ]);
    headerRow3.font = { bold: true };
    headerRow3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c3 = 0;
    let totalAmount3 = 0;
    let totalAmountRemaining3 = 0;

    attendance.studentsExcused.forEach(async (student) => {
      c3++;
      const row = worksheet.addRow([
        c3,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
        `${student.centerName} - ${student.Grade} - ${student.gradeType} - ${student.groupTime}`,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount3 += student.balance;
      totalAmountRemaining3 += student.amountRemaining;

      if (c3 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

      // Send notification to parent
      await sendLocalizedAttendanceNotification(
        student.parentPhone,
        'present',
        {
          type: 'attendance_present',
          studentName: student.Username,
          studentCode: student.Code,
          group: `${student.centerName} - ${student.Grade} - ${student.groupTime}`,
          absences: student.absences,
          hwLine: '',
          date: today,
        }
      );
    });

    // Add total row for Present Other Group  Students
    const totalRowPresent3 = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount3,
      totalAmountRemaining3,
    ]);
    totalRowPresent3.font = { bold: true };
    totalRowPresent3.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent3.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent3.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add absent students section
    row = worksheet.addRow(['Absent Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FF0000' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add absent students data
    const headerRow2 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow2.font = { bold: true };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c2 = 0;
    attendance.studentsAbsent.forEach(async (student) => {
      c2++;
      const row = worksheet.addRow([
        c2,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      if (c2 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

      let subMessage = '';
      if (student.absences >= 3) {
        subMessage = `\n\n⛔ تنبيه: لن يتمكن الطالب من دخول الحصة القادمة بسبب تجاوز عدد مرات الغياب المسموح بها.`;
      }

      // Send notification to parent
      await sendLocalizedAttendanceNotification(
        student.parentPhone,
        'absent',
        {
          type: 'attendance_absent',
          studentName: student.Username,
          studentCode: student.Code,
          group: `${student.centerName} - ${student.Grade} - ${student.groupTime}`,
          absences: student.absences,
          date: today,
          warningMessage: student.absences >= 3 ? subMessage : '',
        }
      );
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx',
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error finalizing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// =================================================== All Notifications =================================================== //

const Notification = require('../models/Notification');

const allNotifications_get = async (req, res) => {
  res.render('teacher/allNotifications', {
    title: 'All Notifications',
    path: req.path,
  });
};

const getAllNotifications = async (req, res) => {
  try {
    const { startDate, endDate, type, phone, page = 1, limit = 20 } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (type) {
      query.type = type;
    }

    if (phone) {
      query.parentPhone = { $regex: phone, $options: 'i' };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('studentId', 'Username Code phone parentPhone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Notification.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit, 10)) || 1;

    res.json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        total,
        limit: parseInt(limit, 10),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      data: null,
    });
  }
};

const getNotificationsStats = async (req, res) => {
  try {
    const { startDate, endDate, type, phone } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) {
        match.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    if (type) {
      match.type = type;
    }

    if (phone) {
      match.parentPhone = { $regex: phone, $options: 'i' };
    }

    const stats = await Notification.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Notification.countDocuments(match);

    const formattedStats = {
      total,
      attendance: 0,
      payment: 0,
      homework: 0,
      block: 0,
      unblock: 0,
      custom: 0,
    };

    stats.forEach((stat) => {
      if (stat && stat._id && typeof formattedStats[stat._id] !== 'undefined') {
        formattedStats[stat._id] = stat.count;
      }
    });

    res.json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      data: null,
    });
  }
};

// =================================================== Send Notifications =================================================== //

const sendNotifications_get = async (req, res) => {
  res.render('teacher/sendNotifications', {
    title: 'Send Notifications',
    path: req.path,
  });
};

const searchStudentsForNotifications = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    // Build the search query - Code is a Number field, so handle it separately
    const searchConditions = [
      { Username: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { parentPhone: { $regex: q, $options: 'i' } },
    ];

    // Only add Code search if the query is a valid number
    const parsedCode = parseInt(q, 10);
    if (!isNaN(parsedCode)) {
      searchConditions.push({ Code: parsedCode });
    }

    const students = await User.find({
      $or: searchConditions,
    })
      .select('Username Code phone parentPhone fcmToken')
      .limit(20)
      .lean();

    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Error searching students:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      data: [],
    });
  }
};

const sendNotificationsToStudents = async (req, res) => {
  try {
    const { students, title, message } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى اختيار طالب واحد على الأقل',
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'يرجى كتابة نص الرسالة',
      });
    }

    const studentDocs = await User.find({ _id: { $in: students } });

    let sent = 0;
    let failed = 0;

    for (const student of studentDocs) {
      try {
        const phone = student.parentPhone || student.phone;

        if (!phone) {
          failed += 1;
          continue;
        }

        const notificationTitle = title || 'Mayada Academy';
        const result = await sendNotificationMessage(
          phone,
          `${notificationTitle}: ${message}`,
          {
            studentId: student._id,
            studentCode: student.Code,
            studentName: student.Username,
            type: 'custom',
            sentBy: 'teacher',
          },
        );

        if (result.success) {
          sent += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        console.error('Error sending notification to student:', err);
        failed += 1;
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      message: `تم إرسال ${sent} إشعار بنجاح`,
    });
  } catch (error) {
    console.error('Error sending notifications to students:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const sendCustomNotification = async (req, res) => {
  try {
    const { phone, title, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة',
      });
    }

    const normalized = phone.replace(/\D/g, '').slice(-9);

    const student = await User.findOne({
      $or: [
        { phone: { $regex: normalized } },
        { parentPhone: { $regex: normalized } },
      ],
    });

    const result = await sendNotificationMessage(
      phone,
      `${title || 'Mayada Academy'}: ${message}`,
      {
        studentId: student?._id,
        studentCode: student?.Code,
        studentName: student?.Username,
        type: 'custom',
        sentBy: 'custom',
      },
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'تم إرسال الإشعار بنجاح',
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'فشل في إرسال الإشعار',
      });
    }
  } catch (error) {
    console.error('Error sending custom notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const sendNotificationToAllParents = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'يرجى كتابة نص الرسالة',
      });
    }

    const query = { parentPhone: { $exists: true, $ne: null, $ne: '' } };

    const parents = await User.find(query)
      .select('Username Code phone parentPhone fcmToken')
      .lean();

    let sent = 0;
    let failed = 0;
    const total = parents.length;

    for (const parent of parents) {
      try {
        const phone = parent.parentPhone;

        if (!phone) {
          failed += 1;
          continue;
        }

        const personalizedMessage = message.replace(
          /{name}/g,
          parent.Username || 'الطالب',
        );

        const result = await sendNotificationMessage(
          phone,
          `${title || 'Mayada Academy'}: ${personalizedMessage}`,
          {
            studentId: parent._id,
            studentCode: parent.Code,
            studentName: parent.Username,
            type: 'custom',
            sentBy: 'all_parents_broadcast',
          },
        );

        if (result.success) {
          sent += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        console.error('Error sending notification to parent:', err);
        failed += 1;
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      total,
      message: `تم إرسال ${sent} إشعار من أصل ${total}`,
    });
  } catch (error) {
    console.error('Error sending notifications to all parents:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getGroupStudentsForNotifications = async (req, res) => {
  try {
    const { centerName, Grade, gradeType, groupTime } = req.query;

    if (!centerName || !Grade || !gradeType || !groupTime) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة',
      });
    }

    const query = { centerName, Grade, gradeType, groupTime };

    const students = await User.find(query)
      .select('Username Code phone parentPhone fcmToken _id')
      .lean();

    res.json({
      success: true,
      students,
    });
  } catch (error) {
    console.error('Error getting group students for notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const sendNotificationsToGroup = async (req, res) => {
  try {
    const {
      data,
      centerName,
      Grade,
      gradeType,
      groupTime,
      option,
      quizName,
      maxGrade,
      messageContent,
    } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات للإرسال',
      });
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const item of data) {
      try {
        if (!item.parentPhone || item.parentPhone === '-') {
          failed += 1;
          continue;
        }

        // Get user's language preference
        const userLang = await getUserLanguage(item.parentPhone);

        if (option === 'HWStatus') {
          if (item.hwStatus === 'none') continue;

          const hwStatus = item.hwStatus === 'yes' 
            ? (userLang === 'AR' ? 'حل الواجب ✅' : 'Homework Done ✅')
            : (userLang === 'AR' ? 'لم يحل الواجب ❌' : 'Homework Not Done ❌');
          
          try {
            const result = await sendLocalizedHomeworkNotification(
              item.parentPhone,
              {
                studentId: item.studentId,
                studentCode: item.studentCode,
                studentName: item.studentName,
                hwStatus: hwStatus,
                solvText: '',
                sentBy: 'group_notification',
                centerName,
                Grade,
                gradeType,
                groupTime,
              }
            );

            if (result.success) {
              sent += 1;
            } else {
              failed += 1;
              errors.push(item.parentPhone);
            }
          } catch (phoneErr) {
            console.error('Error sending to phone:', item.parentPhone, phoneErr);
            failed += 1;
            errors.push(item.parentPhone);
          }
        } else if (option === 'gradeMsg') {
          if (!item.grade || item.grade === '') continue;

          try {
            const result = await sendLocalizedQuizNotification(
              item.parentPhone,
              {
                studentId: item.studentId,
                studentCode: item.studentCode,
                studentName: item.studentName,
                quizName: quizName,
                grade: item.grade,
                maxGrade: maxGrade,
                sentBy: 'group_notification',
                centerName,
                Grade,
                gradeType,
                groupTime,
              }
            );

            if (result.success) {
              sent += 1;
            } else {
              failed += 1;
              errors.push(item.parentPhone);
            }
          } catch (phoneErr) {
            console.error('Error sending to phone:', item.parentPhone, phoneErr);
            failed += 1;
            errors.push(item.parentPhone);
          }
        } else if (option === 'sendMsg') {
          const studentPlaceholder = userLang === 'AR' ? 'الطالب' : 'Student';
          const messageToSend = messageContent.replace(
            /{name}/g,
            item.studentName || studentPlaceholder,
          );

          try {
            const result = await sendNotificationMessage(
              item.parentPhone,
              `Mayada Academy: ${messageToSend}`,
              {
                studentId: item.studentId,
                studentCode: item.studentCode,
                studentName: item.studentName,
                type: 'custom',
                sentBy: 'group_notification',
                centerName,
                Grade,
                gradeType,
                groupTime,
              },
            );

            if (result.success) {
              sent += 1;
            } else {
              failed += 1;
              errors.push(item.parentPhone);
            }
          } catch (phoneErr) {
            console.error('Error sending to phone:', item.parentPhone, phoneErr);
            failed += 1;
            errors.push(item.parentPhone);
          }
        }
      } catch (itemErr) {
        console.error('Error processing item:', itemErr);
        failed += 1;
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      errors,
      message: `تم إرسال ${sent} إشعار`,
    });
  } catch (error) {
    console.error('Error sending notifications to group:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const sendNotificationFromExcelJson = async (req, res) => {
  try {
    const {
      title = 'Mayada Academy',
      sendType,
      phoneColumn,
      nameColumn,
      hwColumn,
      quizName,
      gradeColumn,
      maxGrade,
      messageContent,
      excelData,
    } = req.body;

    if (!sendType || !phoneColumn || !nameColumn) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال نوع الإرسال وأسماء الأعمدة المطلوبة',
      });
    }

    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات في الملف',
      });
    }

    let sent = 0;
    let failed = 0;
    const total = excelData.length;

    for (const row of excelData) {
      const phone = row[phoneColumn]?.toString();
      const name = row[nameColumn]?.toString();

      if (!phone) {
        failed += 1;
        continue;
      }

      try {
        // Get user's language preference
        const userLang = await getUserLanguage(phone);

        if (sendType === 'hwStatus') {
          const hwStatus = hwColumn ? row[hwColumn]?.toString() : '';
          if (!hwStatus) {
            failed += 1;
            continue;
          }
          const hwText =
            hwStatus.toLowerCase() === 'yes' || hwStatus === 'نعم'
              ? (userLang === 'AR' ? 'حل الواجب ✅' : 'Homework Done ✅')
              : (userLang === 'AR' ? 'لم يحل الواجب ❌' : 'Homework Not Done ❌');
          
          const result = await sendLocalizedHomeworkNotification(
            phone,
            {
              studentName: name,
              hwStatus: hwText,
              solvText: '',
              sentBy: 'excel',
              source: 'excel_json',
              sendType,
            },
          );

          if (result.success) {
            sent += 1;
          } else {
            failed += 1;
          }
        } else if (sendType === 'gradeMsg') {
          const gradeValue = gradeColumn ? row[gradeColumn]?.toString() : '';
          if (!gradeValue) {
            failed += 1;
            continue;
          }
          
          const result = await sendLocalizedQuizNotification(
            phone,
            {
              studentName: name,
              quizName: quizName,
              grade: gradeValue,
              maxGrade: maxGrade,
              sentBy: 'excel',
              source: 'excel_json',
              sendType,
            },
          );

          if (result.success) {
            sent += 1;
          } else {
            failed += 1;
          }
        } else if (sendType === 'sendMsg') {
          const studentPlaceholder = userLang === 'AR' ? 'الطالب' : 'Student';
          const messageToSend = messageContent.replace(/{name}/g, name || studentPlaceholder);

          const result = await sendNotificationMessage(
            phone,
            `${title}: ${messageToSend}`,
            {
              studentName: name,
              type: 'custom',
              sentBy: 'excel',
              source: 'excel_json',
              sendType,
            },
          );

          if (result.success) {
            sent += 1;
          } else {
            failed += 1;
          }
        }
      } catch (err) {
        console.error('Error sending notification from excel row:', err);
        failed += 1;
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      total,
      message: `Sent ${sent} notifications out of ${total}`,
    });
  } catch (error) {
    console.error('Error processing excel json data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// =================================================== END Add Card  &&  Attendance =================================================== //

// =================================================== Handel Attendance =================================================== //

const handelAttendanceGet = async (req, res) => {
  res.render('teacher/handelAttendance', {
    title: 'handelAttendance',
    path: req.path,
  });
};

const getDates = async (req, res) => {
  const { Grade, centerName, GroupTime, gradeType } = req.body;
  console.log(Grade, centerName, GroupTime);
  try {
    const group = await Group.findOne({
      Grade,
      CenterName: centerName,
      GroupTime,
      gradeType,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const attendanceRecords = await Attendance.find({ groupId: group._id });
    console.log(attendanceRecords);
    if (!attendanceRecords) {
      return res
        .status(404)
        .json({ message: 'No attendance records found for this session.' });
    }

    const dates = attendanceRecords.map((record) => record.date);
    return res.status(200).json({ Dates: dates });
  } catch (error) {
    console.error('Error fetching dates:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const getAttendees = async (req, res) => {
  const { Grade, centerName, GroupTime, gradeType, date } = req.body;

  try {
    const group = await Group.findOne({
      Grade,
      CenterName: centerName,
      GroupTime,
      gradeType,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const attendance = await Attendance.findOne({
      groupId: group._id,
      date,
    }).populate('studentsPresent studentsAbsent studentsLate studentsExcused');

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for this session.' });
    }

    return res
      .status(200)
      .json({ attendance, message: 'Attendance record found successfully' });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const convertAttendeesToExcel = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType } = req.body;

  try {
    // Find the group
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      GroupTime: GroupTime,
      gradeType: gradeType,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Find today's attendance record for the group
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());

    let attendance = await Attendance.findOne({
      groupId: group._id,
      date: today,
    }).populate('studentsPresent studentsAbsent studentsLate studentsExcused');

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);
    titleRow.font = { size: 27, bold: true };
    worksheet.mergeCells('A1:H1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add group info
    const groupInfoRow = worksheet.addRow([
      'Grade',
      'Center Name',
      'Group Time',
      'Date',
    ]);
    groupInfoRow.font = { bold: true };

    worksheet.addRow([Grade, centerName, GroupTime, today]);

    // Add present students section
    let row = worksheet.addRow([]);
    row = worksheet.addRow(['Present Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c = 0;
    let totalAmount = 0;
    let totalAmountRemaining = 0;

    attendance.studentsPresent.forEach((student) => {
      c++;
      const row = worksheet.addRow([
        c,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount += student.balance;
      totalAmountRemaining += student.amountRemaining;

      if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add total row for Present Students
    const totalRowPresent = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount,
      totalAmountRemaining,
    ]);
    totalRowPresent.font = { bold: true, size: 15 };
    totalRowPresent.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add absent students section
    row = worksheet.addRow(['Absent Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FF0000' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add absent students data
    const headerRow2 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow2.font = { bold: true };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c2 = 0;

    attendance.studentsAbsent.forEach((student) => {
      c2++;
      const row = worksheet.addRow([
        c2,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      if (c2 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add late students section
    row = worksheet.addRow(['Late Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FFA500' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add late students data
    const headerRow3 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow3.font = { bold: true };
    headerRow3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c3 = 0;
    let totalAmountLate = 0;
    let totalAmountRemainingLate = 0;

    attendance.studentsLate.forEach((student) => {
      c3++;
      const row = worksheet.addRow([
        c3,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmountLate += student.balance;
      totalAmountRemainingLate += student.amountRemaining;

      if (c3 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add total row for Late Students
    const totalRowLate = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmountLate,
      totalAmountRemainingLate,
    ]);
    totalRowLate.font = { bold: true, size: 15 };
    totalRowLate.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowLate.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowLate.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add present Other Group students section
    row = worksheet.addRow(['Present From Other Group Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow4 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
      'Group Info',
    ]);
    headerRow4.font = { bold: true };
    headerRow4.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c4 = 0;
    let totalAmount4 = 0;
    let totalAmountRemaining4 = 0;

    attendance.studentsExcused.forEach(async (student) => {
      c4++;
      const row = worksheet.addRow([
        c4,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
        `${student.centerName} - ${student.Grade} - ${student.gradeType} - ${student.groupTime}`,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount4 += student.balance;
      totalAmountRemaining4 += student.amountRemaining;

      if (c4 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

      // Send notification to parent
      await sendLocalizedAttendanceNotification(
        student.parentPhone,
        'present',
        {
          type: 'attendance_present',
          studentName: student.Username,
          studentCode: student.Code,
          group: `${student.centerName} - ${student.Grade} - ${student.groupTime}`,
          absences: student.absences,
          hwLine: '',
          date: today,
        }
      );
    });

    // Add total row for Present Other Group  Students
    const totalRowPresent4 = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount4,
      totalAmountRemaining4,
    ]);
    totalRowPresent4.font = { bold: true };
    totalRowPresent4.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent4.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent4.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx',
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error finalizing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// =================================================== END Handel Attendance =================================================== //

// =================================================== My Student Data =================================================== //

const getStudentData = async (req, res) => {
  const studentCode = req.params.studentCode;
  const { start, end } = req.query; // Extract start and end dates from query parameters

  try {
    // Find student based on the provided code
    const student = await User.findOne({ Code: studentCode });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let attendanceHistory = student.AttendanceHistory;

    // Filter attendance based on date range if provided
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      attendanceHistory = attendanceHistory.filter((record) => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    // Build a response object with relevant fields and filtered attendance history
    const studentData = {
      Code: student.Code,
      Username: student.Username,
      centerName: student.centerName,
      groupTime: student.groupTime,
      phone: student.phone,
      parentPhone: student.parentPhone,
      absences: student.absences,
      balance: student.balance,
      amountRemaining: student.amountRemaining,
      attendanceHistory: attendanceHistory.map((record) => ({
        date: record.date,
        status: record.status,
        time: record.atTime,
      })), // Map attendance history for easy response format
    };
    console.log(studentData);
    // Return the student data in the response
    return res.status(200).json(studentData);
  } catch (error) {
    console.error('Error fetching student data:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const fs = require('fs');
const path = require('path');

// Define a directory where reports will be stored
const reportsDirectory = path.join(__dirname, 'attendance_reports');

// Ensure the directory exists
if (!fs.existsSync(reportsDirectory)) {
  fs.mkdirSync(reportsDirectory);
}

const convertAttendaceToExcel = async (req, res) => {
  const studentCode = req.params.studentCode;
  console.log(studentCode);
  try {
    // Find student based on the provided code
    const student = await User.findOne({ Code: studentCode });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const workbook = new Excel.Workbook();

    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);

    titleRow.font = { size: 27, bold: true };

    worksheet.mergeCells('A1:H1');

    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add student info
    const studentInfoRow = worksheet.addRow([
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);

    studentInfoRow.font = { bold: true };

    worksheet.addRow([
      student.Username,
      student.Code,
      student.phone,
      student.parentPhone,
      student.absences,
      student.balance,
      student.amountRemaining,
    ]);

    // Add attendance history section
    let row = worksheet.addRow([]);

    row = worksheet.addRow(['Attendance History']);

    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };

    worksheet.mergeCells(`A${row.number}:H${row.number}`);

    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add attendance history data

    const headerRow = worksheet.addRow(['Date', 'Status', 'Time']);

    headerRow.font = { bold: true };

    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    student.AttendanceHistory.forEach((record) => {
      const row = worksheet.addRow([record.date, record.status, record.atTime]);
      row.font = { size: 13 };
    });

    // Add borders to all cells

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
    const buffer = await workbook.xlsx.writeBuffer(); // Generates buffer from workbook
    const base64Excel = buffer.toString('base64');
    // Define the file path to save the report locally
    const fileName = `${studentCode}_attendance.xlsx`;
    const filePath = path.join(reportsDirectory, fileName);

    // Save the Excel file to the local filesystem
    await workbook.xlsx.writeFile(filePath);

    // Create a public URL to the file (you may need to expose the directory statically)
    const fileUrl = `${req.protocol}://${req.get(
      'host',
    )}/attendance_reports/${fileName}`;

    // Use WhatsApp API to send the URL
    // await sendWappiMessage(fileUrl, student.parentPhone, req.userData.phone)
    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx',
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error converting attendance to Excel:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =================================================== END My Student Data =================================================== //

// =================================================== Notifications =================================================== //

const sendGradeMessages = async (req, res) => {
  const {
    phoneCloumnName,
    gradeCloumnName,
    nameCloumnName,
    dataToSend,
    quizName,
    maxGrade,
    examEntryCloumnName,
    courseName,
    isOnlineQuiz,
  } = req.body;

  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  // Emit initial status
  req.io.emit('sendingMessages', {
    nMessages: 0,
    totalMessages: dataToSend.length,
    successCount: 0,
    errorCount: 0,
    status: 'starting',
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < dataToSend.length; i++) {
      const student = dataToSend[i];
      const grade = student[gradeCloumnName] ?? 0;
      const phone = student[phoneCloumnName];
      const name = student[nameCloumnName];

      // Check if student entered the exam (default to 1 if not specified)
      const examEntry = examEntryCloumnName
        ? (student[examEntryCloumnName] ?? 1)
        : 1;

      console.log(
        `Processing ${i + 1}/${dataToSend.length}: ${name} (${phone})`,
      );

      let message = '';

      if (isOnlineQuiz) {
        // Online Quiz format
        if (examEntry === 0) {
          // Student did not enter the exam
          message = `
السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
*${name}*
${courseName || ''}
بعدم حل امتحان اليوم❌
*${quizName}*
          `;
        } else {
          // Student entered the exam (default case)
          message = `
السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
*${name}*
${courseName || ''}
بحل امتحان حصة اليوم✅
*${quizName}*
وحصل على درجه ${grade}/${maxGrade}
          `;
        }
      } else {
        // Regular exam format
        if (examEntry === 0) {
          // Student did not enter the exam
          message = `
السلام عليكم 
مع حضرتك Assistant Miss Mayada EST/ACT/SAT Teacher 
برجاء العلم ان الطالب *${name}* ${courseName ? `(${courseName})` : ''} لم يدخل الامتحان (*${quizName}*)
          `;
        } else {
          // Student entered the exam (default case)
          message = `
السلام عليكم 
مع حضرتك Assistant Miss Mayada EST/ACT/SAT Teacher 
برجاء العلم ان تم حصول الطالب *${name}* ${courseName ? `(${courseName})` : ''} على درجة (*${grade}*) من (*${maxGrade}*) في (*${quizName}*) 
          `;
        }
      }

      try {
        const result = await sendNotificationMessage(phone, message, {
          type: 'grade_message',
        });
        successCount++;

        // Emit progress update
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: name,
          lastResult: 'success',
        });

        console.log(`✅ Success: Message sent to ${name}`);
      } catch (err) {
        errorCount++;
        const errorInfo = {
          student: name,
          phone: phone,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        errors.push(errorInfo);

        // Emit progress update with error
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: name,
          lastResult: 'error',
          lastError: err.message,
        });

        console.error(`❌ Error sending message to ${name}:`, err.message);
      }

      // Introduce a random delay between 5 and 8 seconds
      const randomDelay = Math.floor(Math.random() * (8 - 5 + 1) + 5) * 1000;
      console.log(
        `Delaying for ${randomDelay / 1000} seconds before sending the next message.`,
      );
      await delay(randomDelay);
    }

    // Emit final status
    req.io.emit('sendingMessages', {
      nMessages: dataToSend.length,
      totalMessages: dataToSend.length,
      successCount,
      errorCount,
      status: 'completed',
      errors: errors,
    });

    if (errorCount > 0) {
      res.status(207).json({
        message: `Messages completed with ${errorCount} errors`,
        successCount,
        errorCount,
        errors,
        totalMessages: dataToSend.length,
      });
    } else {
      res.status(200).json({
        message: 'All messages sent successfully',
        successCount,
        errorCount: 0,
        totalMessages: dataToSend.length,
      });
    }
  } catch (error) {
    console.error('Critical error in sendGradeMessages:', error);

    // Emit error status
    req.io.emit('sendingMessages', {
      nMessages: 0,
      totalMessages: dataToSend.length,
      successCount,
      errorCount,
      status: 'failed',
      error: error.message,
    });

    res.status(500).json({
      message: 'Critical error occurred while sending messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: dataToSend.length,
    });
  }
};

const sendMessages = async (req, res) => {
  const {
    phoneCloumnName,
    nameCloumnName,
    dataToSend,
    HWCloumnName,
    courseName,
  } = req.body;

  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  // Emit initial status
  req.io.emit('sendingMessages', {
    nMessages: 0,
    totalMessages: dataToSend.length,
    successCount: 0,
    errorCount: 0,
    status: 'starting',
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < dataToSend.length; i++) {
      const student = dataToSend[i];
      let msg = '';
      const courseNameText = courseName || 'Basics Course';

      if (!student[HWCloumnName]) {
        msg = `بعدم حل واجب حصة اليوم❌`;
      } else {
        msg = `بحل واجب حصة اليوم✅`;
      }

      let theMessage = `السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
${student[nameCloumnName]}
${courseNameText}
${msg}`;

      try {
        const result = await sendNotificationMessage(
          student[phoneCloumnName],
          theMessage,
          {
            studentName: student[nameCloumnName],
            type: 'homework_status',
          },
        );
        successCount++;

        // Emit progress update
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: student[nameCloumnName],
          lastResult: 'success',
        });

        console.log(`✅ Success: Message sent to ${student[nameCloumnName]}`);
      } catch (err) {
        errorCount++;
        const errorInfo = {
          student: student[nameCloumnName],
          phone: student[phoneCloumnName],
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        errors.push(errorInfo);

        // Emit progress update with error
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: student[nameCloumnName],
          lastResult: 'error',
          lastError: err.message,
        });

        console.error(
          `❌ Error sending message to ${student[nameCloumnName]}:`,
          err.message,
        );
      }

      // Introduce a random delay between 5 and 8 seconds
      const randomDelay = Math.floor(Math.random() * (8 - 5 + 1) + 5) * 1000;
      console.log(
        `Delaying for ${randomDelay / 1000} seconds before sending the next message.`,
      );
      await delay(randomDelay);
    }

    // Emit final status
    req.io.emit('sendingMessages', {
      nMessages: dataToSend.length,
      totalMessages: dataToSend.length,
      successCount,
      errorCount,
      status: 'completed',
      errors: errors,
    });

    if (errorCount > 0) {
      res.status(207).json({
        message: `Messages completed with ${errorCount} errors`,
        successCount,
        errorCount,
        errors,
        totalMessages: dataToSend.length,
      });
    } else {
      res.status(200).json({
        message: 'All messages sent successfully',
        successCount,
        errorCount: 0,
        totalMessages: dataToSend.length,
      });
    }
  } catch (error) {
    console.error('Critical error in sendMessages:', error);

    // Emit error status
    req.io.emit('sendingMessages', {
      nMessages: 0,
      totalMessages: dataToSend.length,
      successCount,
      errorCount,
      status: 'failed',
      error: error.message,
    });

    res.status(500).json({
      message: 'Critical error occurred while sending messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: dataToSend.length,
    });
  }
};

// General custom messages from Excel
const sendCustomMessages = async (req, res) => {
  const {
    recipientType, // 'parents' | 'students' | 'both'
    parentPhoneColumnName,
    studentPhoneColumnName,
    nameCloumnName,
    message,
    dataToSend,
  } = req.body;

  let successCount = 0;
  let errorCount = 0;
  let errors = [];
  let totalMessages = 0;

  // Calculate total messages to be sent
  for (const row of dataToSend) {
    const targets = [];
    if (recipientType === 'parents' || recipientType === 'both') {
      const parentPhone = parentPhoneColumnName
        ? row[parentPhoneColumnName]
        : undefined;
      if (parentPhone) targets.push(parentPhone);
    }
    if (recipientType === 'students' || recipientType === 'both') {
      const studentPhone = studentPhoneColumnName
        ? row[studentPhoneColumnName]
        : undefined;
      if (studentPhone) targets.push(studentPhone);
    }
    totalMessages += targets.length;
  }

  // Emit initial status
  req.io.emit('sendingMessages', {
    nMessages: 0,
    totalMessages: totalMessages,
    successCount: 0,
    errorCount: 0,
    status: 'starting',
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let messageIndex = 0;

    for (const row of dataToSend) {
      const name = nameCloumnName ? row[nameCloumnName] : 'Unknown';
      const baseMessage = message || '';

      const targets = [];
      if (recipientType === 'parents' || recipientType === 'both') {
        const parentPhone = parentPhoneColumnName
          ? row[parentPhoneColumnName]
          : undefined;
        if (parentPhone) targets.push({ phone: parentPhone, type: 'parent' });
      }
      if (recipientType === 'students' || recipientType === 'both') {
        const studentPhone = studentPhoneColumnName
          ? row[studentPhoneColumnName]
          : undefined;
        if (studentPhone)
          targets.push({ phone: studentPhone, type: 'student' });
      }

      for (const target of targets) {
        try {
          // Personalize header based on recipient type
          const header =
            target.type === 'parent'
              ? `هذه الرساله موجه لولي امر الطالب ${name}`
              : `عزيزي الطالب ${name}`;
          const personalizedText = `${header}\n\n${baseMessage}`;

          await sendNotificationMessage(target.phone, personalizedText, {
            studentName: name,
            type: 'custom_message',
            recipientType: target.type,
          });
          successCount++;
          messageIndex++;

          // Emit progress update
          req.io.emit('sendingMessages', {
            nMessages: messageIndex,
            totalMessages: totalMessages,
            successCount,
            errorCount,
            status: 'progress',
            currentStudent: name,
            lastResult: 'success',
            targetType: target.type,
          });

          console.log(`✅ Success: Message sent to ${name} (${target.type})`);
        } catch (err) {
          errorCount++;
          messageIndex++;
          const errorInfo = {
            student: name,
            phone: target.phone,
            type: target.type,
            error: err.message,
            timestamp: new Date().toISOString(),
          };
          errors.push(errorInfo);

          // Emit progress update with error
          req.io.emit('sendingMessages', {
            nMessages: messageIndex,
            totalMessages: totalMessages,
            successCount,
            errorCount,
            status: 'progress',
            currentStudent: name,
            lastResult: 'error',
            lastError: err.message,
            targetType: target.type,
          });

          console.error(
            `❌ Error sending message to ${name} (${target.type}):`,
            err.message,
          );
        }

        const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
        await delay(randomDelay);
      }
    }

    // Emit final status
    req.io.emit('sendingMessages', {
      nMessages: totalMessages,
      totalMessages: totalMessages,
      successCount,
      errorCount,
      status: 'completed',
      errors: errors,
    });

    if (errorCount > 0) {
      res.status(207).json({
        message: `Messages completed with ${errorCount} errors`,
        successCount,
        errorCount,
        errors,
        totalMessages: totalMessages,
      });
    } else {
      res.status(200).json({
        message: 'All messages sent successfully',
        successCount,
        errorCount: 0,
        totalMessages: totalMessages,
      });
    }
  } catch (error) {
    console.error('Critical error in sendCustomMessages:', error);

    // Emit error status
    req.io.emit('sendingMessages', {
      nMessages: 0,
      totalMessages: totalMessages,
      successCount,
      errorCount,
      status: 'failed',
      error: error.message,
    });

    res.status(500).json({
      message: 'Critical error occurred while sending messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: totalMessages,
    });
  }
};

// =================================================== END Whats App =================================================== //

// =================================================== Student Data =================================================== //

const getDataStudentInWhatsApp = async (req, res) => {
  const { centerName, Grade, gradeType, groupTime } = req.query;
  try {
    const group = await Group.findOne({
      CenterName: centerName,
      Grade,
      gradeType,
      GroupTime: groupTime,
    }).populate('students');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const students = group.students;
    return res.status(200).json({ students });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const submitData = async (req, res) => {
  const { data, option, quizName, maxGrade, instanceID } = req.body;
  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  // Emit initial status
  req.io.emit('sendingMessages', {
    nMessages: 0,
    totalMessages: data.length,
    successCount: 0,
    errorCount: 0,
    status: 'starting',
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < data.length; i++) {
      const student = data[i];
      let theMessage = '';

      if (option === 'HWStatus') {
        let msg = '';
        if (student['hwStatus'] == 'no') {
          msg = `لم يقم الطالب ${student['studentName']} بحل واجب حصة اليوم`;
        } else {
          msg = `لقد قام الطالب ${student['studentName']} بحل واجب حصة اليوم`;
        }
        theMessage = `
السلام عليكم 
مع حضرتك Assistant Miss Mayada EST/ACT/SAT Teacher 
${msg}
`;
      } else if (option === 'gradeMsg') {
        theMessage = `
السلام عليكم
مع حضرتك Assistant Miss Mayada EST/ACT/SAT Teacher
برجاء العلم ان تم حصول الطالب ${student['studentName']} على درجة (${student['grade'] ? student['grade'] : 'لم يحضر'}) من (${maxGrade}) في (${quizName})
`;
      }

      try {
        await sendNotificationMessage(student['parentPhone'], theMessage, {
          studentName: student['studentName'],
          type: option === 'HWStatus' ? 'homework_status' : 'grade_message',
        });
        successCount++;

        // Emit progress update
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: data.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: student['studentName'],
          lastResult: 'success',
        });

        console.log(`✅ Success: Message sent to ${student['studentName']}`);
      } catch (err) {
        errorCount++;
        const errorInfo = {
          student: student['studentName'],
          phone: student['parentPhone'],
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        errors.push(errorInfo);

        // Emit progress update with error
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: data.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: student['studentName'],
          lastResult: 'error',
          lastError: err.message,
        });

        console.error(
          `❌ Error sending message to ${student['studentName']}:`,
          err.message,
        );
      }

      // Introduce a random delay between 5 and 8 seconds
      const randomDelay = Math.floor(Math.random() * (8 - 5 + 1) + 5) * 1000;
      console.log(
        `Delaying for ${randomDelay / 1000} seconds before sending the next message.`,
      );
      await delay(randomDelay);
    }

    // Emit final status
    req.io.emit('sendingMessages', {
      nMessages: data.length,
      totalMessages: data.length,
      successCount,
      errorCount,
      status: 'completed',
      errors: errors,
    });

    if (errorCount > 0) {
      res.status(207).json({
        message: `Messages completed with ${errorCount} errors`,
        successCount,
        errorCount,
        errors,
        totalMessages: data.length,
      });
    } else {
      res.status(200).json({
        message: 'All messages sent successfully',
        successCount,
        errorCount: 0,
        totalMessages: data.length,
      });
    }
  } catch (error) {
    console.error('Critical error in submitData:', error);

    // Emit error status
    req.io.emit('sendingMessages', {
      nMessages: 0,
      totalMessages: data.length,
      successCount,
      errorCount,
      status: 'failed',
      error: error.message,
    });

    res.status(500).json({
      message: 'Critical error occurred while sending messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: data.length,
    });
  }
};

const sendAttendanceMessages = async (req, res) => {
  const {
    courseName,
    phoneColumnName,
    nameColumnName,
    attendanceValueColumnName,
    attendanceTimeColumnName,
    cameraColumnName,
    totalSessionTime,
    dataToSend,
  } = req.body;

  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  // Emit initial status
  req.io.emit('sendingMessages', {
    nMessages: 0,
    totalMessages: dataToSend.length,
    successCount: 0,
    errorCount: 0,
    status: 'starting',
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < dataToSend.length; i++) {
      const student = dataToSend[i];
      const studentName = student[nameColumnName];
      const phoneNumber = student[phoneColumnName];
      const attendanceValue = student[attendanceValueColumnName];
      const attendanceTime = attendanceTimeColumnName
        ? student[attendanceTimeColumnName]
        : null;
      const cameraStatus = cameraColumnName ? student[cameraColumnName] : null;

      let message = '';

      // Determine message based on attendance value
      if (attendanceValue == 1) {
        // Student attended
        let cameraText = '';
        if (cameraStatus == 1) {
          cameraText = '\n\nمع العلم أن الطالب قام بفتح الكاميرا خلال الحصة.';
        } else if (cameraStatus == 0) {
          cameraText =
            '\n\nمع العلم أن الطالب لم يقم بفتح الكاميرا خلال الحصة.';
        }

        if (
          attendanceTime &&
          attendanceTime > 0 &&
          attendanceTime < totalSessionTime
        ) {
          // Partial attendance
          message = `السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
${studentName}
${courseName}
بحضور حصة اليوم✅

مع العلم أن الطالب حضر فقط ${attendanceTime} دقيقة من أصل ${totalSessionTime} دقيقة مدة الحصة.${cameraText}`;
        } else {
          // Full attendance
          message = `السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
${studentName}
${courseName}
بحضور حصة اليوم✅${cameraText}`;
        }
      } else {
        // Student absent
        message = `السلام عليكم 🙏🏻
مع حضرتك Assistant Miss Mayada 

لقد قام الطالب
${studentName}
${courseName}
بعدم حضور حصة اليوم❌`;
      }

      try {
        await sendNotificationMessage(phoneNumber, message, {
          studentName: studentName,
          type: 'attendance_status',
          courseName: courseName,
        });
        successCount++;

        // Emit progress update
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: studentName,
          lastResult: 'success',
        });

        console.log(`✅ Success: Attendance message sent to ${studentName}`);
      } catch (err) {
        errorCount++;
        const errorInfo = {
          student: studentName,
          phone: phoneNumber,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        errors.push(errorInfo);

        // Emit progress update with error
        req.io.emit('sendingMessages', {
          nMessages: i + 1,
          totalMessages: dataToSend.length,
          successCount,
          errorCount,
          status: 'progress',
          currentStudent: studentName,
          lastResult: 'error',
          lastError: err.message,
        });

        console.error(
          `❌ Error sending attendance message to ${studentName}:`,
          err.message,
        );
      }

      // Introduce a random delay between 5 and 8 seconds
      const randomDelay = Math.floor(Math.random() * (8 - 5 + 1) + 5) * 1000;
      console.log(
        `Delaying for ${randomDelay / 1000} seconds before sending the next message.`,
      );
      await delay(randomDelay);
    }

    // Emit final status
    req.io.emit('sendingMessages', {
      nMessages: dataToSend.length,
      totalMessages: dataToSend.length,
      successCount,
      errorCount,
      status: 'completed',
      errors: errors,
    });

    if (errorCount > 0) {
      res.status(207).json({
        message: `Messages sent with ${errorCount} errors`,
        successCount,
        errorCount,
        totalMessages: dataToSend.length,
        errors: errors,
      });
    } else {
      res.json({
        message: 'All attendance messages sent successfully',
        successCount,
        errorCount: 0,
        totalMessages: dataToSend.length,
      });
    }
  } catch (error) {
    console.error('Critical error in sendAttendanceMessages:', error);

    // Emit error status
    req.io.emit('sendingMessages', {
      status: 'failed',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: dataToSend.length,
    });

    res.status(500).json({
      message: 'Critical error occurred while sending attendance messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: dataToSend.length,
    });
  }
};

// Collection messages (dynamic multi-date attendance/HW/quiz report)
const sendCollectionMessages = async (req, res) => {
  const {
    studentNameColumn,
    parentPhoneColumn,
    // Generic simple prefixes (legacy fallback)
    datePrefix,
    attendancePrefix,
    hwPrefix,
    quizPrefix,
    // Structured prefixes (recommended, like other parts)
    datePrefixStructured, // e.g., 'Date'
    attendanceValuePrefix, // e.g., 'AttendanceValue' -> 1/0
    attendanceTimePrefix, // e.g., 'AttendanceTime' -> minutes attended
    cameraPrefix, // e.g., 'Camera' -> 1/0
    hwStatusPrefix, // e.g., 'HWStatus' -> yes/no/1/0
    quizNamePrefix, // e.g., 'QuizName'
    gradePrefix, // e.g., 'Grade'
    maxGradePrefix, // e.g., 'MaxGrade'
    examEntryPrefix, // e.g., 'ExamEntry' -> 1/0
    totalSessionTime, // number (minutes) to compare partial attendance
    headerIntro,
    title,
    dataToSend,
  } = req.body;

  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  // Emit initial status
  if (req.io) {
    req.io.emit('sendingMessages', {
      nMessages: 0,
      totalMessages: Array.isArray(dataToSend) ? dataToSend.length : 0,
      successCount: 0,
      errorCount: 0,
      status: 'starting',
    });
  }

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Helper: build segments for a row based on prefixes and numeric suffixes
    const buildSegments = (row) => {
      const keys = Object.keys(row || {});
      const indexSet = new Set();

      const collectIndex = (prefix) => {
        if (!prefix) return;
        keys.forEach((k) => {
          if (k.startsWith(prefix)) {
            const suffix = k.slice(prefix.length);
            const idx =
              suffix && /^\d+$/.test(suffix) ? parseInt(suffix, 10) : 1;
            indexSet.add(idx);
          }
        });
      };

      // legacy simple prefixes
      collectIndex(datePrefix);
      collectIndex(attendancePrefix);
      collectIndex(hwPrefix);
      collectIndex(quizPrefix);
      // structured prefixes
      collectIndex(datePrefixStructured);
      collectIndex(attendanceValuePrefix);
      collectIndex(attendanceTimePrefix);
      collectIndex(cameraPrefix);
      collectIndex(hwStatusPrefix);
      collectIndex(quizNamePrefix);
      collectIndex(gradePrefix);
      collectIndex(maxGradePrefix);
      collectIndex(examEntryPrefix);

      let indices = Array.from(indexSet);
      indices.sort((a, b) => a - b);
      if (indices.length === 0) indices = [1];

      const getVal = (prefix, idx) => {
        if (!prefix) return undefined;
        const keyWithIndex = `${prefix}${idx}`;
        if (Object.prototype.hasOwnProperty.call(row, keyWithIndex))
          return row[keyWithIndex];
        // fallback to plain prefix (no index) for first segment
        if (idx === 1 && Object.prototype.hasOwnProperty.call(row, prefix))
          return row[prefix];
        return undefined;
      };

      return indices.map((i) => ({
        // legacy simple
        date: getVal(datePrefix, i) ?? getVal(datePrefixStructured, i),
        attendance: getVal(attendancePrefix, i),
        hw: getVal(hwPrefix, i),
        quiz: getVal(quizPrefix, i),
        // structured
        attendanceValue: getVal(attendanceValuePrefix, i),
        attendanceTime: getVal(attendanceTimePrefix, i),
        camera: getVal(cameraPrefix, i),
        hwStatus: getVal(hwStatusPrefix, i),
        quizName: getVal(quizNamePrefix, i),
        grade: getVal(gradePrefix, i),
        maxGrade: getVal(maxGradePrefix, i),
        examEntry: getVal(examEntryPrefix, i),
      }));
    };

    for (let i = 0; i < dataToSend.length; i++) {
      const row = dataToSend[i];
      const studentName = row[studentNameColumn] || 'Unknown';
      const parentPhone = row[parentPhoneColumn];

      // Compose message
      const segments = buildSegments(row);

      let message = '';
      message += 'السلام عليكم 🙏🏻\n';
      message += 'مع حضرتك Assistant Miss Mayada\n\n';
      message += `${title || 'تقرير الطالب'}\n`;
      message += `${studentName}\n`;
      if (headerIntro) message += `${headerIntro}\n`;
      message += '\n';

      segments.forEach((seg) => {
        // If using structured fields, format like the other parts; otherwise, fallback to legacy simple text
        const usingStructured =
          seg.attendanceValue !== undefined ||
          seg.attendanceTime !== undefined ||
          seg.camera !== undefined ||
          seg.hwStatus !== undefined ||
          seg.quizName !== undefined ||
          seg.grade !== undefined ||
          seg.maxGrade !== undefined ||
          seg.examEntry !== undefined;

        if (
          !seg.date &&
          !usingStructured &&
          !seg.attendance &&
          !seg.hw &&
          !seg.quiz
        )
          return;
        if (seg.date) message += `التاريخ ${seg.date}\n`;

        if (usingStructured) {
          // Attendance
          if (seg.attendanceValue == 1) {
            message += `الحضور: تم الحضور✅\n`;

            // Always add time info if provided
            if (seg.attendanceTime && Number(seg.attendanceTime) > 0) {
              message += `مع العلم أن الطالب حضر ${seg.attendanceTime} دقيقة من أصل 120 دقيقة مدة الحصة.\n`;
            }
            // Camera info on a separate line if provided (only if camera value is explicitly set)
            if (seg.camera !== undefined && seg.camera !== '') {
              if (seg.camera == 1) {
                message += `مع العلم أن الطالب قام بفتح الكاميرا خلال الحصة.\n`;
              } else if (seg.camera == 0) {
                message += `مع العلم أن الطالب لم يقم بفتح الكاميرا خلال الحصة.\n`;
              }
            }
          } else if (seg.attendanceValue == 0) {
            message += `الحضور: لم يتم الحضور❌\n`;
          }

          // Homework (prefer numeric 1/0; still compatible with old values)
          if (seg.hwStatus !== undefined && seg.hwStatus !== '') {
            const asString = String(seg.hwStatus).trim().toLowerCase();
            if (
              asString === '1' ||
              asString === 'yes' ||
              asString === 'تم' ||
              asString === 'نعم' ||
              asString === 'true'
            ) {
              message += `الواجب: تم حل الواجب✅\n`;
            } else if (
              asString === '0' ||
              asString === 'no' ||
              asString === 'لم' ||
              asString === 'لا' ||
              asString === 'false'
            ) {
              message += `الواجب: لم يتم حل الواجب❌\n`;
            } else {
              message += `الواجب: ${seg.hwStatus}\n`;
            }
          } else {
            // If HWStatus is empty, show "no homework"
            message += `الواجب: لم يكن هناك واجب\n`;
          }

          // Quiz
          if (
            seg.examEntry !== undefined &&
            seg.examEntry !== '' &&
            seg.examEntry == 0
          ) {
            message += `الامتحان: لم يدخل الامتحان❌\n`;
          } else if (seg.quizName || seg.grade || seg.maxGrade) {
            let quizLine = 'الامتحان: ';
            if (seg.quizName) quizLine += `${seg.quizName}`;
            if (seg.grade !== undefined && seg.maxGrade !== undefined) {
              quizLine +=
                (seg.quizName ? ' | ' : '') +
                `الدرجة: ${seg.grade}/${seg.maxGrade}`;
            }
            message += quizLine + '\n';
          } else {
            // If no quiz data provided, show "no quiz"
            message += `الامتحان: لم يكن هناك امتحان\n`;
          }
        } else {
          // Legacy fallback formatting
          if (
            seg.attendance !== undefined &&
            seg.attendance !== null &&
            seg.attendance !== ''
          ) {
            // If legacy sheet also provides attendanceTime, include partial attendance phrasing
            if (
              seg.attendanceTime &&
              totalSessionTime &&
              Number(seg.attendanceTime) > 0 &&
              Number(seg.attendanceTime) < Number(totalSessionTime)
            ) {
              message += `الحضور: ${seg.attendance}\nمع العلم أن الطالب حضر فقط ${seg.attendanceTime} دقيقة من أصل ${totalSessionTime} دقيقة مدة الحصة.\n`;
            } else {
              message += `الحضور: ${seg.attendance}\n`;
            }
          }
          if (seg.hw !== undefined && seg.hw !== null && seg.hw !== '') {
            message += `الواجب: ${seg.hw}\n`;
          }
          if (seg.quiz !== undefined && seg.quiz !== null && seg.quiz !== '') {
            message += `الامتحان: ${seg.quiz}\n`;
          }
        }

        message += '\n';
      });

      try {
        await sendNotificationMessage(parentPhone, message, {
          type: 'collection_report',
          studentName: studentName,
        });
        successCount++;
        if (req.io) {
          req.io.emit('sendingMessages', {
            nMessages: i + 1,
            totalMessages: dataToSend.length,
            successCount,
            errorCount,
            status: 'progress',
            currentStudent: studentName,
            lastResult: 'success',
          });
        }
      } catch (err) {
        errorCount++;
        const errorInfo = {
          student: studentName,
          phone: parentPhone,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        errors.push(errorInfo);
        if (req.io) {
          req.io.emit('sendingMessages', {
            nMessages: i + 1,
            totalMessages: dataToSend.length,
            successCount,
            errorCount,
            status: 'progress',
            currentStudent: studentName,
            lastResult: 'error',
            lastError: err.message,
          });
        }
      }

      // Changed delay to be between 6-8 seconds
      const messageDelay = Math.floor(Math.random() * (8000 - 6000 + 1) + 6000);
      await delay(messageDelay);
    }

    if (req.io) {
      req.io.emit('sendingMessages', {
        nMessages: dataToSend.length,
        totalMessages: dataToSend.length,
        successCount,
        errorCount,
        status: 'completed',
        errors: errors,
      });
    }

    if (errorCount > 0) {
      return res.status(207).json({
        message: `Messages completed with ${errorCount} errors`,
        successCount,
        errorCount,
        errors,
        totalMessages: dataToSend.length,
      });
    }

    return res.status(200).json({
      message: 'All collection messages sent successfully',
      successCount,
      errorCount: 0,
      totalMessages: dataToSend.length,
    });
  } catch (error) {
    console.error('Critical error in sendCollectionMessages:', error);
    if (req.io) {
      req.io.emit('sendingMessages', {
        nMessages: 0,
        totalMessages: Array.isArray(dataToSend) ? dataToSend.length : 0,
        successCount,
        errorCount,
        status: 'failed',
        error: error.message,
      });
    }
    return res.status(500).json({
      message: 'Critical error occurred while sending collection messages',
      error: error.message,
      successCount,
      errorCount,
      totalMessages: Array.isArray(dataToSend) ? dataToSend.length : 0,
    });
  }
};

// Generate sample Excel for collection messages
const collectionSampleExcel = async (req, res) => {
  try {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Collection Sample');

    // Headers
    const headers = [
      'studentName',
      'parentPhone',
      // First segment (structured prefixes without suffix for segment 1)
      'Date',
      'AttendanceValue',
      'AttendanceTime',
      'Camera',
      'HWStatus',
      'ExamEntry',
      'QuizName',
      'Grade',
      'MaxGrade',
      // Second segment
      'Date2',
      'AttendanceValue2',
      'AttendanceTime2',
      'Camera2',
      'HWStatus2',
      'ExamEntry2',
      'QuizName2',
      'Grade2',
      'MaxGrade2',
      // Third segment
      'Date3',
      'AttendanceValue3',
      'AttendanceTime3',
      'Camera3',
      'HWStatus3',
      'ExamEntry3',
      'QuizName3',
      'Grade3',
      'MaxGrade3',
    ];
    worksheet.addRow(headers);

    // Case 1: Present with partial time, camera off, HW done, no exam
    worksheet.addRow([
      'Lamis Yasser Mohamed',
      '01200000000',
      // seg1
      '17/9', // Date
      1, // AttendanceValue: present
      70, // AttendanceTime (minutes)
      0, // Camera: not opened
      1, // HWStatus: done
      '', // ExamEntry: empty (no exam)
      '', // QuizName
      '', // Grade
      '', // MaxGrade
      // seg2
      '20/9', // Date2
      0, // AttendanceValue2: absent
      '', // AttendanceTime2
      '', // Camera2
      1, // HWStatus2: done
      1, // ExamEntry2: entered
      'Vocab Quiz 19/9', // QuizName2
      5, // Grade2
      10, // MaxGrade2
      // seg3
      '25/9', // Date3
      1, // AttendanceValue3: present
      '', // AttendanceTime3
      '', // Camera3
      0, // HWStatus3: not done
      '', // ExamEntry3: empty (no exam)
      '', // QuizName3
      '', // Grade3
      '', // MaxGrade3
    ]);

    // Case 2: Present with camera, no HW, quiz with score; then present with HW, no exam; then empty
    worksheet.addRow([
      'Omar Ali',
      '01211111111',
      // seg1
      '10/9',
      1, // present
      '',
      1, // camera opened
      '', // HWStatus: empty (no homework)
      1, // ExamEntry
      'Quiz Unit 1',
      9,
      10,
      // seg2
      '12/9',
      1, // present
      '',
      '', // camera: empty (not required)
      1, // HWStatus: done
      '', // ExamEntry: empty (no exam)
      '',
      '',
      '',
      // seg3 empty
      '15/9',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    // Case 3: Date only, then absent with no exam, then present with quiz
    worksheet.addRow([
      'Sara Mohamed',
      '01222222222',
      // seg1
      '01/10',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      // seg2
      '05/10',
      0, // absent
      '',
      '',
      '',
      0, // no exam
      '',
      '',
      '',
      // seg3
      '08/10',
      1, // present
      '',
      '',
      '',
      1, // entered exam
      'Quiz Unit 2',
      7,
      10,
    ]);

    // Case 4: Present with full time, camera on, no HW, no exam
    worksheet.addRow([
      'Ahmed Hassan',
      '01233333333',
      // seg1
      '03/10',
      1, // present
      120, // full time
      1, // camera opened
      '', // HWStatus: empty (no homework)
      '', // ExamEntry: empty (no exam)
      '',
      '',
      '',
      // seg2
      '05/10',
      1, // present
      90, // partial time
      '', // camera: empty (not required)
      0, // HWStatus: not done
      1, // ExamEntry: entered
      'Math Quiz',
      8,
      10,
      // seg3
      '07/10',
      0, // absent
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    // Column widths for readability
    worksheet.columns = headers.map(() => ({ width: 22 }));

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Collection_Message_Sample.xlsx',
    );
    res.send(buffer);
  } catch (error) {
    console.error('Error generating sample Excel:', error);
    res
      .status(500)
      .json({
        success: false,
        message: 'Failed to generate sample Excel',
        error: error.message,
      });
  }
};

// =================================================== END Whats app 2 =================================================== //

// =================================================== Convert Group =================================================== //

const convertGroup_get = (req, res) => {
  res.render('teacher/convertGroup', { title: 'convertGroup', path: req.path });
};

const getDataToTransferring = async (req, res) => {
  const { Code } = req.params;

  try {
    const student = await User.findOne({
      $or: [{ cardId: Code }, { Code: +Code }],
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const groups = await Group.find({
      Grade: student.Grade,
      CenterName: student.centerName,
      gradeType: student.gradeType,
    });

    if (!groups) {
      return res
        .status(404)
        .json({ message: 'No groups found for this student' });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const transferStudent = async (req, res) => {
  const { centerName, Grade, gradeType, groupTime } = req.body;
  const { Code } = req.params;
  console.log(req.body);
  try {
    const student = await User.findOne({
      $or: [{ cardId: Code }, { Code: +Code }],
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const group = await Group.findOne({
      Grade,
      CenterName: centerName,
      GroupTime: groupTime,
      gradeType,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Remove the student from any previous group
    await Group.updateMany(
      { students: student._id },
      { $pull: { students: student._id } },
    );

    // Check if the student is already in the group
    if (group.students.includes(student._id)) {
      return res
        .status(400)
        .json({ message: 'Student is already in the group' });
    }

    // Update the student's group info
    student.centerName = centerName;
    student.Grade = Grade;
    student.gradeType = gradeType;
    student.groupTime = groupTime;
    // Save with validation disabled to avoid required field errors
    try {
      await student.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.warn(
        `Error saving student ${student.Username} (ID: ${student._id}):`,
        saveError.message,
      );
      return res.status(500).json({ message: 'Error updating student data' });
    }

    // Transfer the student to the new group
    group.students.push(student._id);
    await group.save();

    return res
      .status(200)
      .json({ message: 'Student transferred successfully' });
  } catch (error) {
    console.error('Error transferring student:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// =================================================== Send Registration Message =================================================== //

const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
};

const exportErrorDetailsToExcel = async (req, res) => {
  const { errors } = req.body;

  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No error data provided for export',
    });
  }

  try {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Error Details');

    // Simple header row with only essential columns
    const headerRow = worksheet.addRow([
      'Student Name',
      'Parent Phone Number',
      'HW Status',
      'Error Message',
    ]);

    // Add data rows
    errors.forEach((error) => {
      worksheet.addRow([
        error.student || '',
        error.phone || '',
        error.hwStatus || '',
        error.error || '',
      ]);
    });

    // Set column widths
    worksheet.columns = [
      { key: 'studentName', width: 20 },
      { key: 'phoneNumber', width: 15 },
      { key: 'hwStatus', width: 15 },
      { key: 'errorMessage', width: 40 },
    ];

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ErrorDetails_${new Date().toISOString().split('T')[0]}.xlsx"`,
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting error details to Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export error details to Excel',
      error: error.message,
    });
  }
};

module.exports = {
  dash_get,

  myStudent_get,

  studentsRequests_get,
  // confirmDeleteStudent,
  DeleteStudent,
  searchForUser,
  converStudentRequestsToExcel,
  getSingleUserAllData,
  updateUserData,

  searchToGetOneUserAllData,
  convertToExcelAllUserData,

  addCardGet,
  markAttendance,
  finalizeAttendance,

  addCardToStudent,
  getAttendedUsers,
  removeAttendance,
  updateAmount,

  handelAttendanceGet,
  getDates,
  getAttendees,
  convertAttendeesToExcel,

  // My Student Data
  getStudentData,
  convertAttendaceToExcel,

  // Notifications
  sendGradeMessages,
  sendMessages,
  sendCustomMessages,
  sendAttendanceMessages,
  sendCollectionMessages,
  collectionSampleExcel,
  // New FCM Notifications pages
  allNotifications_get,
  getAllNotifications,
  getNotificationsStats,
  sendNotifications_get,
  searchStudentsForNotifications,
  sendNotificationsToStudents,
  sendNotificationFromExcelJson,
  sendCustomNotification,
  sendNotificationToAllParents,
  getGroupStudentsForNotifications,
  sendNotificationsToGroup,

  // Student Data
  getDataStudentInWhatsApp,
  submitData,
  // Convert Group
  convertGroup_get,
  getDataToTransferring,
  transferStudent,

  logOut,
  exportErrorDetailsToExcel,
};
