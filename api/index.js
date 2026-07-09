// Vercel invokes this file as a serverless function. Express apps are
// themselves valid (req, res) handlers, so re-exporting is enough.
module.exports = require('../server/src/index.js');
