const crypto = require('crypto')
const config = require('./config.json')

module.exports = enroll => {
  const hmac = crypto.createHmac('sha256', config.secret)
  hmac.update(enroll.toString())
  return hmac.digest('hex').slice(0, 4)
}
