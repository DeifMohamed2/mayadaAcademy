const express = require("express");
const User = require("../models/User");



const teacherController = require('../controllers/teacherController')
const router = express.Router();
const jwt = require('jsonwebtoken')
const jwtSecret = process.env.JWTSECRET


// ================== authMiddleware====================== //

const authMiddleware =async (req,res,next)=>{
    const token = req.cookies.token ; 
  
    if (!token) {
      res.status(401).redirect('../login')
    }
  
    try {
      const decode = jwt.verify(token,jwtSecret)
      req.userId = decode.userId
 
      await User.findOne({'_id':decode.userId}).then((result)=>{
        if (result.isTeacher) {
          
          next();
        }else{
          res.clearCookie('token');
          res.status(301).redirect('../login')
        }
     
      })

    } catch (error) {
      res.status(401).redirect('../login')
  
    }
}

// ================== END authMiddleware====================== //


// ================== All get Pages Route  ====================== //


router.get('/dash', authMiddleware, teacherController.addCardGet);

router.get("/myStudent", authMiddleware,teacherController.myStudent_get);


router.get("/studentsRequests", authMiddleware,teacherController.studentsRequests_get);

router.get("/logOut", authMiddleware,teacherController.logOut);


// ================== END All get Pages Route  ====================== //



// ==================  Student Requests  ================= //



router.get("/studentsRequests/:studentID", authMiddleware,teacherController.getSingleUserAllData);

router.get("/studentsRequests/delete/:studentID", authMiddleware,teacherController.confirmDeleteStudent);

router.post("/studentsRequests/delete/:studentID", authMiddleware,teacherController.DeleteStudent);

router.post("/converStudentRequestsToExcel", authMiddleware,teacherController.converStudentRequestsToExcel);

router.post("/searchForUser", authMiddleware,teacherController.searchForUser);

router.post("/updateUserData/:studentID", authMiddleware,teacherController.updateUserData);


// ==================  END Student Requests  ================= //

// ==================   myStudent  ================= //


router.get("/myStudent/getStudentData/:studentCode", authMiddleware,teacherController.getStudentData);

router.get("/myStudent/convertToExcel/:studentCode", authMiddleware,teacherController.convertAttendaceToExcel);


router.post("/myStudent/convertToExcelAllUserData/:studetCode", authMiddleware,teacherController.convertToExcelAllUserData);

// router.post("/myStudent/convertToPDFAllUserData/:studetCode", authMiddleware,teacherController.convertToPDFAllUserData);


// ==================   END myStudent  ================= //

// ================== Add Card To Sudent ====================== //

router.get('/addCard', authMiddleware, teacherController.addCardGet);

router.post('/addCard', authMiddleware, teacherController.addCardToStudent);

router.post('/addCard/getAttendedUsers', authMiddleware, teacherController.getAttendedUsers);

router.post('/addCard/markAttendance',authMiddleware,teacherController.markAttendance);


router.delete('/addCard/removeAttendance/:studentId',authMiddleware,teacherController.removeAttendance);

router.post('/addCard/updateAmount/:studentId',authMiddleware,teacherController.updateAmount);

router.post('/addCard/finalizeAttendance',authMiddleware,teacherController.finalizeAttendance);






// ================== End Add Card To Sudent ================= //



// ================== Handel Attendace ====================== //



router.get('/handelAttendance', authMiddleware, teacherController.handelAttendanceGet);


router.post('/handelAttendance/getDates', authMiddleware, teacherController.getDates);

router.post('/handelAttendance/getAttendees', authMiddleware, teacherController.getAttendees);

router.post('/handelAttendance/convertAttendeesToExcel', authMiddleware, teacherController.convertAttendeesToExcel);


// ================== Whats App ====================== //

router.get('/whatsApp', authMiddleware, teacherController.whatsApp_get);

router.post('/sendGradeMessages', authMiddleware, teacherController.sendGradeMessages);
router.post('/sendMessages', authMiddleware, teacherController.sendMessages);





module.exports = router;
