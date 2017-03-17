const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const crypto = require('crypto')
const mysql = require('mysql')

const config = require('./config.json')
const voted = []
const connection = mysql.createConnection(config.connection)
const app = express()

app.use(cors())
app.use(bodyParser.json())

const authenticate = (req, res, next) => {

  // Missing credentials
  if (!req.body.enroll || !req.body.key) {
    res.json({ok: false, error: 'Missing credentials.'})
    return
  }

  // Invalid Credentials
  const hmac = crypto.createHmac('sha256', config.secret)
  hmac.update(req.body.enroll)
  if (hmac.digest('hex').slice(0, 4) != req.body.key) {
    res.json({ok: false, error: 'Erroneous credentials.'})
    return
  }

  // Already Voted
  if (voted.indexOf(req.body.enroll) >= 0) {
    res.json({ok: false, error: 'Already voted.'})
    return
  }

  next()
}

const validateForm = (req, res, next) => {
  const form = req.body.form
  if (!form
    || !form.risingStar
    || !form.sportsIcon
    || !form.face || !form.face.male || !form.face.female
    || !form.styleIcon || !form.styleIcon.male || !form.styleIcon.female
    || !form.persona || !form.persona.male || !form.persona.female
    || !form.artist || !form.artist.male || !form.artist.female
  ) {
    res.json({ok: false, error: 'Missing form entries.'})
    return
  }
  next()
}

app.get('/data.min.js', express.static(__dirname + '/data'))

app.post('/login', authenticate, (_, res) => {
  res.json({ok: true})
})

app.post('/vote', authenticate, validateForm, (req, res) => {
  const form = req.body.form
  connection.query('INSERT INTO votes VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
    req.body.enroll,
    form.risingStar,
    form.sportsIcon,
    form.face.male,
    form.face.female,
    form.styleIcon.male,
    form.styleIcon.female,
    form.persona.male,
    form.persona.female,
    form.artist.male,
    form.artist.female
  ], (error) => {
    if (!error) voted.push(req.body.enroll)
    res.json({ok: !error, error: error ? error : undefined})
  })
})

connection.connect(() => {
  console.log(`Connected to ${
    config.connection.user}:${
    config.connection.password}@${
    config.connection.host}/${
    config.connection.database}`
  )
  connection.query('SELECT enrollment_no FROM votes', (_, results) => {
    results.forEach(result => {
      voted.push(result.enrollment_no)
    })
    app.listen(config.app.port, () => {
      console.log(`Serving from ${config.app.port}`)
    })
  })
})
