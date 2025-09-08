const { createApp } = require('../../src/app')
const { awsLambdaFastify } = require('@fastify/aws-lambda')

let cachedHandler

function normalizeNetlifyPath(event) {
  // Netlify Functions forward requests under 
  //   /.netlify/functions/<functionName>/...
  // Fastify app expects paths like /api/v1/...
  const stripPrefixRe = /^\/\.netlify\/functions\/[^/]+/i
  const rawPath = event.rawPath || event.path || ''
  if (stripPrefixRe.test(rawPath)) {
    const normalized = rawPath.replace(stripPrefixRe, '') || '/'
    event.rawPath = normalized
    if (event.path) event.path = event.path.replace(stripPrefixRe, '') || '/'
  }
}

exports.handler = async (event, context) => {
  if (!cachedHandler) {
    const app = await createApp()
    cachedHandler = awsLambdaFastify(app, { callbackWaitsForEmptyEventLoop: true })
  }
  // Ensure paths match Fastify routes when called via Netlify
  if (event) normalizeNetlifyPath(event)
  return cachedHandler(event, context)
}
