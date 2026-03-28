/**
 * One-time: set displayText for Group docs missing it (defaults to GroupTime).
 * Usage: node scripts/backfillGroupDisplayText.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');
const { connectDB } = require('../config/db');

async function run() {
  await connectDB();
  const groups = await Group.find({
    $or: [{ displayText: { $exists: false } }, { displayText: null }, { displayText: '' }],
  }).lean();
  let n = 0;
  for (const g of groups) {
    await Group.updateOne(
      { _id: g._id },
      { $set: { displayText: g.GroupTime || 'Group' } },
    );
    n += 1;
  }
  console.log(`Updated ${n} group(s).`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
