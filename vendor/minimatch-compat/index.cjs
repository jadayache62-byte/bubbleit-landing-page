"use strict";

// Next's legacy lint plugins need the callable v3 API; all matching is delegated
// to minimatch 10 so brace patterns use the bounded brace-expansion 5.0.8 code.
/* eslint-disable @typescript-eslint/no-require-imports */
const modern = require("minimatch-modern");
const legacy = modern.minimatch;

Object.assign(legacy, modern);

module.exports = legacy;
