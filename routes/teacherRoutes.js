const express = require("express");
const User = require("../models/User");



const teacherController = require('../controllers/teacherController')
const router = express.Router();
const jwt = require('jsonwebtoken')
const jwtSecret = process.env.JWTSECRET


// ================== authMiddleware====================== //

const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).redirect('../login');
  }

  try {
    const decode = jwt.verify(token, jwtSecret);
    req.userId = decode.userId;

    const result = await User.findOne({ '_id': decode.userId });

    if (!result) {
      res.clearCookie('token');
      return res.status(401).redirect('../login');
    }

    if (result.isTeacher) {
      req.userData = result;
      next();
    } else {
      res.clearCookie('token');
      return res.status(301).redirect('../login');
    }

  } catch (error) {
    res.clearCookie('token');
    return res.status(401).redirect('../login');
  }
};

// ================== END authMiddleware====================== //


// ================== All get Pages Route  ====================== //


router.get('/dash', authMiddleware, teacherController.addCardGet);

router.get("/myStudent", authMiddleware, teacherController.myStudent_get);


router.get("/studentsRequests", authMiddleware, teacherController.studentsRequests_get);

router.get("/logOut", authMiddleware, teacherController.logOut);


// ================== END All get Pages Route  ====================== //



// ==================  Student Requests  ================= //



router.get("/studentsRequests/:studentID", authMiddleware, teacherController.getSingleUserAllData);

router.delete("/studentsRequests/delete/:studentID", authMiddleware, teacherController.DeleteStudent);

router.post("/converStudentRequestsToExcel", authMiddleware, teacherController.converStudentRequestsToExcel);

router.post("/searchForUser", authMiddleware, teacherController.searchForUser);

router.put("/updateUserData/:studentID", authMiddleware, teacherController.updateUserData);


// ==================  END Student Requests  ================= //

// ==================   myStudent  ================= //


router.get("/myStudent/getStudentData/:studentCode", authMiddleware, teacherController.getStudentData);

router.get("/myStudent/convertToExcel/:studentCode", authMiddleware, teacherController.convertAttendaceToExcel);


router.post("/myStudent/convertToExcelAllUserData/:studetCode", authMiddleware, teacherController.convertToExcelAllUserData);

// router.post("/myStudent/convertToPDFAllUserData/:studetCode", authMiddleware,teacherController.convertToPDFAllUserData);


// ==================   END myStudent  ================= //

// ================== Add Card To Sudent ====================== //

router.get('/addCard', authMiddleware, teacherController.addCardGet);

router.post('/addCard', authMiddleware, teacherController.addCardToStudent);

router.post('/addCard/getAttendedUsers', authMiddleware, teacherController.getAttendedUsers);

router.post('/addCard/markAttendance', authMiddleware, teacherController.markAttendance);


router.delete('/addCard/removeAttendance/:studentId', authMiddleware, teacherController.removeAttendance);

router.post('/addCard/updateAmount/:studentId', authMiddleware, teacherController.updateAmount);

router.post('/addCard/finalizeAttendance', authMiddleware, teacherController.finalizeAttendance);






// ================== End Add Card To Sudent ================= //



// ================== Handel Attendace ====================== //



router.get('/handelAttendance', authMiddleware, teacherController.handelAttendanceGet);


router.post('/handelAttendance/getDates', authMiddleware, teacherController.getDates);

router.post('/handelAttendance/getAttendees', authMiddleware, teacherController.getAttendees);

router.post('/handelAttendance/convertAttendeesToExcel', authMiddleware, teacherController.convertAttendeesToExcel);



// ================== Notifications ====================== //

// New FCM Notifications Pages
router.get('/allNotifications', authMiddleware, teacherController.allNotifications_get);
router.get('/sendNotifications', authMiddleware, teacherController.sendNotifications_get);

// New FCM Notifications APIs - routes matching frontend fetch calls
// allNotifications page APIs
router.get('/allNotifications/getNotifications', authMiddleware, teacherController.getAllNotifications);
router.get('/allNotifications/getStats', authMiddleware, teacherController.getNotificationsStats);

// sendNotifications page APIs
router.get('/sendNotifications/searchStudents', authMiddleware, teacherController.searchStudentsForNotifications);
router.post('/sendNotifications/toStudents', authMiddleware, teacherController.sendNotificationsToStudents);
router.post('/sendNotifications/custom', authMiddleware, teacherController.sendCustomNotification);
router.post('/sendNotifications/toAllParents', authMiddleware, teacherController.sendNotificationToAllParents);
router.get('/sendNotifications/getGroupStudents', authMiddleware, teacherController.getGroupStudentsForNotifications);
router.post('/sendNotifications/toGroup', authMiddleware, teacherController.sendNotificationsToGroup);
router.post('/sendNotifications/fromExcelJson', authMiddleware, teacherController.sendNotificationFromExcelJson);



router.post('/sendGradeMessages', authMiddleware, teacherController.sendGradeMessages);
router.post('/sendMessages', authMiddleware, teacherController.sendMessages);
router.post('/sendCustomMessages', authMiddleware, teacherController.sendCustomMessages);
router.post('/sendAttendanceMessages', authMiddleware, teacherController.sendAttendanceMessages);
router.post('/sendCollectionMessages', authMiddleware, teacherController.sendCollectionMessages);
router.get('/collectionSampleExcel', authMiddleware, teacherController.collectionSampleExcel);


// ================== END Notifications ====================== //

// ==================  Student Data  ================= //

router.get('/getDataStudentInWhatsApp', authMiddleware, teacherController.getDataStudentInWhatsApp);

router.post('/submitData', authMiddleware, teacherController.submitData);


// ==================  END Student Data  ================= //

// ================== Export Error Details ====================== //

router.post('/exportErrorDetailsToExcel', authMiddleware, teacherController.exportErrorDetailsToExcel);

// ================== END Export Error Details ================= //

// ==================  Convert Group  ================= //

router.get('/convertGroup', authMiddleware, teacherController.convertGroup_get);

router.get('/getDataToTransferring/:Code', authMiddleware, teacherController.getDataToTransferring);

router.put('/transferStudent/:Code', authMiddleware, teacherController.transferStudent);

module.exports = router;
