const User = require('../models/User');
const Group  = require('../models/Group');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const Card = require('../models/Card');
const Attendance = require('../models/Attendance'); 

const waapi = require('@api/waapi');
const waapiAPI = process.env.WAAPIAPI;
waapi.auth(waapiAPI);

const Excel = require('exceljs'); 
  
const dash_get = async(req, res) => {

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
        balance :1,
        amountRemaining :1,
      }
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
    // Fetch user data
    const users = await User.find(query, {
      Username: 1,
      Email: 1,
      gov: 1,
      Markez: 1,
      gender: 1,
      phone: 1,
      WhatsApp: 1,
      parentPhone: 1,
      place: 1,
      Code: 1,
      createdAt: 1,
      updatedAt: 1,
      subscribe: 1,
    });

    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    const headerRow = worksheet.addRow([
      '#',
      'User Name',
      'Student Code',
      'Student Phone',
      'Parent Phone',
      'Government',
      'Markez',
      'createdAt',
      'subscribe',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add user data to the worksheet with alternating row colors
    let c = 0;
    users.forEach((user) => {
      c++;
      const row = worksheet.addRow([
        c,
        user.Username,
        user.Code,
        user.phone,
        user.WhatsApp,
        user.parentPhone,
        user.gov,
        user.Markez,
        user.createdAt.toLocaleDateString(),
        user.subscribe,
      ]);

      // Apply different fill color based on subscription status
      if (!user.subscribe) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0000' },
        }; // Red fill for non-subscribed users
      } else if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        }; // Alternate fill color for subscribed users
      }
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="UsersData.xlsx"`
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
    await User.findOne(
      { _id: studentID },
     
    ).then((result) => {

      res.status(200).send(result);
    }).catch((error) => {
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
    if (bookTaken) updateFields.bookTaken = bookTaken;
    if (schoolName) updateFields.schoolName = schoolName;
    if (absences) updateFields.absences = absences

    // Optional fields with additional checks
    // if (centerName) updateFields.centerName = centerName;
    // if (Grade) updateFields.Grade = Grade;
    // if (gradeType) updateFields.gradeType = gradeType;
    // if (groupTime) updateFields.groupTime = groupTime;

    // Update the student document
    const updatedUser = await User.findByIdAndUpdate(studentID, updateFields, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
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
    res
      .status(200)
      .json({ message: 'User data updated successfully.', updatedUser });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Internal server error.' });
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
      { $pull: { students: studentID } }
    ).then(async(result) => {
      await User.findByIdAndDelete(studentID).then((result) => {
        res
          .status(200)
          .json({ message: 'User deleted successfully.', result });
      });
  });
  } catch (error) {
    console.log(error);
  }
};
// =================================================== END Student Requests ================================================ //

// ===================================================  MyStudent ================================================ //

const searchToGetOneUserAllData = async (req, res) => {
  const { searchBy, searchInput } = req.query;

  try {
     const result = await User.findOne({ [`${searchBy}`]: searchInput })

     const attendance = await Card.findOne({ userId : result._id })


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
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=users_data.xlsx'
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

async function sendWappiMessage(message, phone, adminPhone) {
  let instanceID = ''
  if(adminPhone=="01200077823"){
    instanceID = '63771'
  }else if(adminPhone=="01200077825"){
    instanceID = '66610'
  }else if(adminPhone=="01200077829"){
    instanceID = '66886'
  }

  return waapi
    .postInstancesIdClientActionSendMessage(
      {
        chatId: `2${phone}@c.us`,
        message: message,
      },
      { id: instanceID }
    )
    .then(({ data }) => {
      return data; // Return data from the resolved promise
    })
    .catch((err) => {
      console.log(err);
      throw err; // Re-throw to be caught by caller
    });
}



const addCardGet = async (req, res) => {
  
  res.render('teacher/addCard', { title: 'addCard', path: req.path });
}

const addCardToStudent = async (req, res) => {
  const { studentCode, assignedCard } = req.body;

  // Check for missing fields
  if (!studentCode || !assignedCard) {
    return res
      .status(400)
      .json({ message: 'studentCode and assignedCard are required' , Username  : null});
  }

  try {
    const userByCode = await User.findOne({ Code: studentCode }, { cardId :1 , Username : 1 , Code : 1 });
    const userHasCard = await User.findOne({ cardId: assignedCard });
    if (!userByCode) {
      return res.status(400).json({ message: 'This student does not exist, please verify the code' ,Username   : ''});
    }

    if(userByCode.cardId){
      return res.status(400).json({ message: 'This student already has a card.' ,Username   : userByCode.Username});
    }

    if (userHasCard) {
      return res.status(400).json({ message: "This card has already been used." ,Username   : `Used by ${userHasCard.Username}`});
    }

    

      await User.updateOne(
        { Code: studentCode },
        {
          cardId: assignedCard,
        }
      ).then((result) => {
        return res.status(200).json({ message: 'تم اضافه الكارت للطالب بنجاح' ,Username   : userByCode.Username});
      }).catch((err) => {
        console.error(err);
        return res.status(500).json({ message: 'يبدو ان هناك خطأ ما ' ,Username   : null});
      });

  } catch (error) {
    console.error('Error adding card:', error);
    return res.status(500).json({ message:'يبدو ان هناك خطأ ما ' ,Username   : null});
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
  } = req.body;

  try {
    const student = await User.findOne({
      $or: [{ cardId: attendId }, { Code: +attendId }],
    });

    if (!student) {
      return res.status(404).json({ message: 'Student Not found' });
    }

      console.log(student._id);
    // Check if student is in the group
    let group =null;
        if (!attendOtherGroup) {
          group = await Group.findOne({
            CenterName: centerName,
            Grade: Grade,
            GroupTime: GroupTime,
            gradeType: gradeType,
            students: student._id,
          });
        }else{
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

      if (attendAbsencet){
        student.absences -= 1;
       
      }else{
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
      return res
        .status(400)
        .json({
          message: 'Student is already marked present From Other Group',
        });
    }



    // Handle if attendance is finalized (late marking logic)
    if (attendance.isFinalized) {
      attendance.studentsAbsent = attendance.studentsAbsent.filter(
        (id) => !id.equals(student._id)
      );
      attendance.studentsLate.push(student._id);

      if (student.absences > 0) {
        student.absences -= 1;
      }

      await attendance.save();

      // Find if an attendance history already exists for today
      const existingHistory = student.AttendanceHistory.find(
        (record) => record.date === today
      );

      if (existingHistory) {
        // Update the status to 'Late' if an entry already exists
        existingHistory.status = 'Late';
        existingHistory.atTime = new Date().toLocaleTimeString();

        // Mark AttendanceHistory as modified to ensure Mongoose updates it
        student.markModified('AttendanceHistory');
      } else {
        // Push a new history entry if it doesn't exist for today
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Late',
        });
      }

      await student.save(); // Save the updated student data

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');

      const messageWappi = `⚠️ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأنه تم التحديث ابنكم قد *تأخر في الحضور اليوم*.\n
وقد تم تسجيل حضوره *متأخرًا*.\n
وحضر في جروب *${centerName} - ${Grade} - ${GroupTime}*.\n
عدد مرات الغياب: *${student.absences}*.\n\n
*يرجى الانتباه لمواعيد الحضور مستقبلًا*.\n\n
التاريخ: ${today}
الوقت: ${new Date().toLocaleTimeString()}
*شكرًا لتعاونكم.*`;

      // Send the message via the waapi (already present)

    await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);

 
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
          let statusMessage =''
          if(attendOtherGroup){
            attendance.studentsExcused.push(student._id);
            statusMessage = 'Present From Other Group'
          }else{

           attendance.studentsPresent.push(student._id);
            statusMessage = 'Present'
          }
          


      await attendance.save();

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');
      console.log(attendance.studentsExcused);

      if (attendOtherGroup){
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Present From Other Group',
        });
      } else {
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Present',
        });
      }

const messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم قد *حضر اليوم في المعاد المحدد*.\n
وقد تم تسجيل حضوره *بنجاح*.\n
وحضر في جروب *${centerName} - ${Grade} - ${GroupTime}*.\n
عدد مرات الغياب: *${student.absences}*.\n
التاريخ: ${today}
الوقت: ${new Date().toLocaleTimeString()}
*شكرًا لتعاونكم.*`;


      // Send the message via the waapi (already present)
      await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);

      await student.save();
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
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};


const getAttendedUsers = async (req, res) => {
  const { Grade, centerName, GroupTime, attendId, gradeType } = req.body;
  const group = await Group.findOne({
    CenterName: centerName,
    Grade: Grade,
    gradeType : gradeType,
    GroupTime: GroupTime,
  });

  if (!group) {
    return res
      .status(404)
      .json({
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
      gradeType : gradeType,
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
      id.equals(student._id)
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
        (id) => !id.equals(student._id)
      );
    }

    // Remove the student from studentsLate if late
    if (isLate) {
      attendance.studentsLate = attendance.studentsLate.filter(
        (id) => !id.equals(student._id)
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
      (att) => !att.attendance.equals(attendance._id) // Use .equals() for ObjectId comparison
    );

    await student.save();
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
    await student.save();
    
    return res.status(200).json({ message: 'Amount updated successfully' });
  }
  catch (error) {
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
      gradeType : gradeType,
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
        id.equals(studentId)
      );
      const isLate = attendance.studentsLate.some((id) => id.equals(studentId));

      console.log( isPresent , isLate);
      if (!isPresent && !isLate) {
      
        if (!attendance.studentsAbsent.includes(studentId)) {
          attendance.studentsAbsent.push(studentId);

          const student = await User.findById(studentId);
         
          if (student) {
          
            student.absences = (student.absences || 0) + 1;
            student.AttendanceHistory.push({  
              attendance: attendance._id,
              date: today,
              atTime : new Date().toLocaleTimeString(),
              status: 'Absent',
            });
            await student.save();
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

    attendance.studentsPresent.forEach(async(student) => {
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
      'Group Info' ,
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

    attendance.studentsExcused.forEach(async(student) => {
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

const messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم قد *حضر اليوم في المعاد المحدد*.\n
وقد تم تسجيل حضوره *بنجاح*.\n
المبلغ المتبقي من سعر الحصة هو: *${student.amountRemaining} جنيه*.\n
عدد مرات الغياب: *${student.absences}*.\n\n
*شكرًا لتعاونكم.*`;


      // Send the message via the waapi (already present)
      await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);



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
    attendance.studentsAbsent.forEach(async(student) => {
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
  subMessage = `\n\n❌ *وفقًا لعدد مرات الغياب التي تم تسجيلها لابنكم*، يرجى العلم أنه *لن يتمكن من دخول الحصة القادمة*.`;
}

const messageWappi = `❌ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم *لم يحضر اليوم*.\n
وقد تم تسجيل غيابه .\n
عدد مرات الغياب: *${student.absences}*.${subMessage}\n\n
*شكرًا لتعاونكم.*`;
 

      // Send the message via the waapi (already present)
      await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);

 

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error finalizing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// =================================================== END Add Card  &&  Attendance =================================================== //



// =================================================== Handel Attendance =================================================== //

const handelAttendanceGet = async (req, res) => {
 
  res.render('teacher/handelAttendance', { title: 'handelAttendance', path: req.path });
}


const getDates = async (req, res) => {
  const { Grade, centerName, GroupTime , gradeType } = req.body;
  console.log(Grade, centerName, GroupTime);
  try {
    const group = await Group.findOne({ Grade, CenterName: centerName, GroupTime , gradeType });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const attendanceRecords = await Attendance.find({ groupId: group._id });
    console.log(attendanceRecords);
    if (!attendanceRecords) {
      return res.status(404).json({ message: 'No attendance records found for this session.' });
    }

    const dates = attendanceRecords.map((record) => record.date);
    res.status(200).json({ Dates: dates });
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }

}

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

      const attendance = await Attendance.findOne({ groupId: group._id, date }).populate('studentsPresent studentsAbsent studentsLate studentsExcused');

      if (!attendance) {
        return res.status(404).json({ message: 'No attendance record found for this session.' });
      }

      res.status(200).json({ attendance , message: 'Attendance record found successfully' });
    } catch (error) {
      console.error('Error fetching attendees:', error);
      res.status(500).json({ message: 'Server error. Please try again.' });

}

}

const convertAttendeesToExcel = async (req, res) => {
  const { centerName, Grade, GroupTime , gradeType } = req.body;

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

      const messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم قد *حضر اليوم في المعاد المحدد*.\n
وقد تم تسجيل حضوره *بنجاح*.\n
المبلغ المتبقي من سعر الحصة هو: *${student.totalAmount4} جنيه*.\n
عدد مرات الغياب: *${student.absences}*.\n\n
*شكرًا لتعاونكم.*`;


      // Send the message via the waapi (already present)
      await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
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
    res.status(200).json(studentData);
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({ message: 'Server error' });
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
      'host'
    )}/attendance_reports/${fileName}`;

    // Use WhatsApp API to send the URL
    // await sendWappiMessage(fileUrl, student.parentPhone, req.userData.phone)
    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error converting attendance to Excel:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =================================================== END My Student Data =================================================== //


// =================================================== Whats App =================================================== //



const whatsApp_get = (req,res)=>{
  res.render('teacher/whatsApp', { title: 'whatsApp', path: req.path });
}


const sendGradeMessages = async (req, res) => {
  const {
    phoneCloumnName,
    gradeCloumnName,
    nameCloumnName,
    dataToSend,
    quizName,
    maxGrade,
  } = req.body;

  let n = 0;
  req.io.emit('sendingMessages', {
    nMessages: n,
  });



  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of dataToSend) {
      const grade = student[gradeCloumnName] ?? 0; // Default grade to 0 if undefined or null
      const phone = student[phoneCloumnName];
      const name = student[nameCloumnName];

      console.log(quizName, student, grade, phone);

      let message = `
السلام عليكم 
مع حضرتك Assistant Miss Mayada EST/ACT Teacher 
برجاء العلم ان تم حصول الطالب ${name} على درجة (${grade}) من (${maxGrade}) في (${quizName}) 
      `;

      try {

        await sendWappiMessage(message, phone, req.userData.phone)
          .then((result) => {
            console.log(result);
            req.io.emit('sendingMessages', {
              nMessages: ++n,
            });
          })
          .catch((err) => {
            console.error(err);
          });


      } catch (err) {
        console.error(`Error sending message to ${name}:`, err);
      }

      // Introduce a random delay between 1 and 5 seconds
      const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
      console.log(
        `Delaying for ${
          randomDelay / 1000
        } seconds before sending the next message.`
      );
      await delay(randomDelay);
    }

    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const sendMessages = async (req, res) => {
  const { phoneCloumnName, nameCloumnName, dataToSend, HWCloumnName  } =
    req.body;

  let n = 0;
  req.io.emit('sendingMessages', {
    nMessages: n,
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of dataToSend) {
      let msg = '';
      console.log(student[HWCloumnName]);
      if (!student[HWCloumnName]) {
        msg = `لم يقم الطالب ${student[nameCloumnName]} بحل واجب حصة اليوم`;
      } else {
        msg = `لقد قام الطالب ${student[nameCloumnName]} بحل واجب حصة اليوم`;
      }

      let theMessage = `
السلام عليكم 
مع حضرتك Assistant Miss Mayada EST/ACT Teacher 
${msg}
      `;

      try {
       
        await sendWappiMessage(theMessage, student[phoneCloumnName], req.userData.phone)
        .then((result) => {
          console.log(result);
          req.io.emit('sendingMessages', {
            nMessages: ++n,
          });
        })
        .catch((err) => {
          console.error(err);
        });
      
        } catch (err) {
        console.error(
          `Error sending message to ${student[nameCloumnName]}:`,
          err
        );
      }

      // Introduce a random delay between 1 and 10 seconds
      const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
      console.log(
        `Delaying for ${
          randomDelay / 1000
        } seconds before sending the next message.`
      );
      await delay(randomDelay);
    }

    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// =================================================== END Whats App =================================================== //



// =================================================== Whats app 2 =================================================== //


const whatsApp2_get = (req, res) => {
  res.render('teacher/whatsApp2', { title: 'whatsApp2', path: req.path });
}

const getDataStudentInWhatsApp = async (req, res) => {
  const {centerName,Grade,gradeType,groupTime} = req.query 
  try {
    const group = await Group.findOne({CenterName:centerName,Grade,gradeType,GroupTime:groupTime}).populate('students')
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const students = group.students;
    res.status(200).json({ students });
  }
  catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }

}

const submitData = async (req, res) => {
  const { data, option, quizName, maxGrade, instanceID } = req.body;
  let n = 0;
  req.io.emit('sendingMessages', {
    nMessages: n,
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of data) {
      console.log(student);
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
مع حضرتك Assistant Miss Mayada EST/ACT Teacher 
${msg}
`;

      }else if (option === 'gradeMsg') {
        theMessage = `
السلام عليكم
مع حضرتك Assistant Miss Mayada EST/ACT Teacher
برجاء العلم ان تم حصول الطالب ${student['studentName']} على درجة (${student['grade']? student['grade'] : 'لم يحضر' }) من (${maxGrade}) في (${quizName})
`;
      }


      try {
        await sendWappiMessage(theMessage, student['parentPhone'], req.userData.phone)
          .then(() => {
            req.io.emit('sendingMessages', {
              nMessages: ++n,
            });
            console.log(`Message sent successfully to ${student['studentName']}`);
          })
          .catch((error) => {
            console.error(`Error sending message to ${student['studentName']}:`, error);
          });
      } catch (err) {
        console.error(`Error sending message to ${student['studentName']}:`, err);
      }

      // Introduce a random delay between 1 and 5 seconds
      const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
      console.log(
        `Delaying for ${
          randomDelay / 1000
        } seconds before sending the next message.`
      );
      await delay(randomDelay);
    }

    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


// =================================================== END Whats app 2 =================================================== //

// =================================================== Convert Group =================================================== //


const convertGroup_get = (req, res) => {
  res.render('teacher/convertGroup', { title: 'convertGroup', path: req.path });
}

const getDataToTransferring = async (req, res) => {
  const {Code} = req.params;

  try {
    const student = await User.findOne({
      $or: [{ cardId: Code }, { Code: +Code }],
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const groups = await Group.find({ Grade: student.Grade, CenterName: student.centerName, gradeType: student.gradeType });

    if (!groups) {
      return res.status(404).json({ message: 'No groups found for this student' });
    }

    res.status(200).json(  student  );
  }
  catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
}

const transferStudent = async (req, res) => {
  const {  centerName, Grade, gradeType, groupTime } = req.body;
  const {Code} = req.params;
  console.log(req.body)
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
      { $pull: { students: student._id } }
    );

    // Check if the student is already in the group
    if (group.students.includes(student._id)) {
      return res.status(400).json({ message: 'Student is already in the group' });
    }


    // Update the student's group info
    student.centerName = centerName;
    student.Grade = Grade;
    student.gradeType = gradeType;
    student.groupTime = groupTime;
    await student.save();

    // Transfer the student to the new group
    group.students.push(student._id);
    await group.save();

    res.status(200).json({ message: 'Student transferred successfully' });
  } catch (error) {
    console.error('Error transferring student:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};


// =================================================== Connect WhatsApp =================================================== //


const connectWhatsapp_get = (req, res) => {
  res.render('teacher/connectWhatsapp', { title: 'Connect WhatsApp', path: req.path });
};

const createInstance = async (req, res) => {
  const { phoneNumber, name } = req.body;
  
  try {
    // Generate a unique instance ID
    const instanceId = Date.now().toString();
    
    // Create a new WhatsApp instance
    const instance = new WhatsAppInstance({
      instanceId,
      phoneNumber,
      name,
      status: 'disconnected',
      qrCode: null
    });
    
    await instance.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Instance created successfully', 
      instance 
    });
  } catch (error) {
    console.error('Error creating instance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating instance',
      error: error.message 
    });
  }
};

const getInstances = async (req, res) => {
  try {
    const instances = await WhatsAppInstance.find({}).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      instances
    });
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching instances',
      error: error.message
    });
  }
};

const checkRealInstanceStatus = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    // First check if the instance exists in our database
    const instance = await WhatsAppInstance.findOne({ instanceId });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    // Use waapi to check the real status
    try {
      const { data } = await waapi.getInstancesIdClientStatus({ id: instanceId });
      if (data && data.status === 'success') {
        const apiStatus = data.clientStatus.instanceStatus;
        
        // Update our instance status based on the API response
        let status;
        switch(apiStatus) {
          case 'ready':
          case 'authenticated':
            status = 'connected';
            break;
          case 'qr':
            status = 'qr'; // Now treating qr status separately from connecting
            break;
          case 'loading_screen':
          case 'booting':
            status = 'connecting';
            break;
          case 'disconnected':
          case 'auth_failure':
          default:
            status = 'disconnected';
            break;
        }
        
        // Update our database record
        instance.status = status;
        await instance.save();
        
        return res.status(200).json({
          success: true,
          apiStatus: apiStatus,
          status: status
        });
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (apiError) {
      console.error('waapi error:', apiError);
      
      // If we can't connect to the API, return the status from our database
      return res.status(200).json({
        success: true,
        apiStatus: 'unknown',
        status: instance.status
      });
    }
  } catch (error) {
    console.error('Error checking instance status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking instance status',
      error: error.message
    });
  }
};

const generateQrCode = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    // Find the instance
    const instance = await WhatsAppInstance.findOne({ instanceId });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    // Use waapi to generate a QR code
    try {

      // Request the QR code
      const { data } = await waapi.getInstancesIdClientQr({ id: instanceId });
      console.log('QR code API response:', JSON.stringify(data));
      
      if (data && data.status === 'success') {
        // Extract QR code based on API response structure
        let qrCodeData = null;
        
        if (data.qrCode && data.qrCode.data && data.qrCode.data.qr_code) {
          // Format from user's example
          qrCodeData = data.qrCode.data.qr_code;
        } else if (data.data && data.data.qr_code) {
          // New API format
          qrCodeData = data.data.qr_code;
        } else if (data.qr && data.qr.code) {
          // Old API format
          qrCodeData = data.qr.code;
        }
        
        if (qrCodeData) {
          // Update instance status to qr
          instance.status = 'qr';
          instance.qrCode = qrCodeData;
          await instance.save();
          
          // Use socket.io to emit status change
          req.io.emit('instance-status-change', {
            instanceId,
            status: 'qr',
            qrCode: instance.qrCode
          });
          
          return res.status(200).json({
            success: true,
            qrCode: instance.qrCode,
            status: instance.status
          });
        }
      }
      
      // If we reach here, we didn't get a valid QR code from the API
      console.error('No valid QR code in API response:', data);
      
      // If QR code wasn't available, use our placeholder
      instance.status = 'qr';
      instance.qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1PADUAAAAAXNSR0IArs4c6QAAELBJREFUeF7tnXmQHVUVxr/XmYRsQzaykUAIeWGHsIV1BhdcqrCKclFB3LdSoVyKKvfCpe...'; // Placeholder
      await instance.save();
      
      req.io.emit('instance-status-change', {
        instanceId,
        status: 'qr',
        qrCode: instance.qrCode
      });
      
      return res.status(200).json({
        success: true,
        qrCode: instance.qrCode,
        status: instance.status
      });
    } catch (apiError) {
      console.error('waapi QR code error:', apiError);
      
      // In a real application, you would use a WhatsApp API client to generate a QR code
      // For this example, we'll simulate it with a placeholder
      
      // Update instance status to connecting
      instance.status = 'qr';
      instance.qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1PADUAAAAAXNSR0IArs4c6QAAELBJREFUeF7tnXmQHVUVxr/XmYRsQzaykUAIeWGHsIV1BhdcqrCKclFB3LdSoVyKKvfCpe...'; // This should be a base64 encoded QR code from the WhatsApp API
      
      await instance.save();
      
      // Use socket.io to emit status change
      req.io.emit('instance-status-change', {
        instanceId,
        status: 'qr',
        qrCode: instance.qrCode
      });
      
      return res.status(200).json({
        success: true,
        qrCode: instance.qrCode,
        status: instance.status,
        error: apiError.message
      });
    }
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating QR code',
      error: error.message
    });
  }
};


const deleteInstance = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    const result = await WhatsAppInstance.deleteOne({ instanceId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    // Emit instance deleted event
    req.io.emit('instance-deleted', {
      instanceId
    });
    
    res.status(200).json({
      success: true,
      message: 'Instance deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting instance:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting instance',
      error: error.message
    });
  }
};


// =================================================== Log Out =================================================== //


const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
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
  

  // WhatsApp

  whatsApp_get,
  sendGradeMessages,
  sendMessages,

  // WhatsApp 2
  whatsApp2_get,
  getDataStudentInWhatsApp,
  submitData,

  // Connect WhatsApp
  connectWhatsapp_get,
  createInstance,
  getInstances,
  generateQrCode,
  deleteInstance,
  checkRealInstanceStatus,

  // Convert Group
  convertGroup_get,
  getDataToTransferring,
  transferStudent,

  logOut,
};
