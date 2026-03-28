/**
 * Canonical group hierarchy (matches legacy views/partials/group.ejs).
 * Used by seed script and documentation; runtime selects use /groupOptions from DB.
 */

const centerNames = {
  ZHub: [
    { value: 'Basics', text: 'Basics' },
    { value: 'SAT', text: 'SAT Advanced' },
    { value: 'EST', text: 'EST Advanced' },
  ],
  tagmo3: [
    { value: 'Basics', text: 'Basics' },
    { value: 'SAT', text: 'SAT Advanced' },
    { value: 'EST', text: 'EST Advanced' },
  ],
  online: [
    { value: 'Basics', text: 'Basics' },
    { value: 'SAT', text: 'SAT Advanced' },
    { value: 'EST', text: 'EST Advanced' },
  ],
};

const gradeTypeOptions = {
  EST: [{ value: 'adv', text: 'Advanced' }],
  SAT: [{ value: 'adv', text: 'Advanced' }],
  Basics: [{ value: 'normal', text: 'Normal' }],
};

const groupTimes = {
  ZHub: {
    Basics: {
      normal: [
        { value: 'group', text: 'Group' },
        { value: 'test', text: 'Test' },
      ],
    },
    SAT: {
      adv: [{ value: 'group', text: 'Group' }],
    },
    EST: {
      adv: [{ value: 'group', text: 'Group' }],
    },
  },
  tagmo3: {
    Basics: {
      normal: [{ value: 'group', text: 'Group' }],
    },
    SAT: {
      adv: [{ value: 'group', text: 'Group' }],
    },
    EST: {
      adv: [{ value: 'group', text: 'Group' }],
    },
  },
  online: {
    Basics: {
      normal: [{ value: 'group', text: 'Group' }],
    },
    SAT: {
      adv: [{ value: 'group', text: 'Group' }],
    },
    EST: {
      adv: [{ value: 'group', text: 'Group' }],
    },
  },
};

/** Allowed centers for creating groups via teacher API */
const ALLOWED_CENTERS = new Set(['ZHub', 'tagmo3', 'online']);

module.exports = {
  centerNames,
  gradeTypeOptions,
  groupTimes,
  ALLOWED_CENTERS,
};
