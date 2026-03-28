/**
 * Upsert all leaf groups from config/groupHierarchy.js into MongoDB.
 * Usage: node scripts/seedGroupsFromGroupPartial.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');
const { connectDB } = require('../config/db');
const { groupTimes } = require('../config/groupHierarchy');

function collectLeaves() {
  const rows = [];
  for (const [center, byGrade] of Object.entries(groupTimes)) {
    for (const [grade, byType] of Object.entries(byGrade)) {
      for (const [gradeType, options] of Object.entries(byType)) {
        for (const opt of options) {
          rows.push({
            CenterName: center,
            Grade: grade,
            gradeType,
            GroupTime: opt.value,
            displayText: opt.text,
            isActive: true,
          });
        }
      }
    }
  }
  return rows;
}

async function run() {
  await connectDB();
  const rows = collectLeaves();
  let upserted = 0;
  for (const row of rows) {
    const res = await Group.updateOne(
      {
        CenterName: row.CenterName,
        Grade: row.Grade,
        gradeType: row.gradeType,
        GroupTime: row.GroupTime,
      },
      {
        $set: {
          displayText: row.displayText,
          isActive: row.isActive,
        },
        $setOnInsert: {
          CenterName: row.CenterName,
          Grade: row.Grade,
          gradeType: row.gradeType,
          GroupTime: row.GroupTime,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount || res.modifiedCount) upserted += 1;
  }
  console.log(`Processed ${rows.length} leaf rows; upserts/updates applied.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
