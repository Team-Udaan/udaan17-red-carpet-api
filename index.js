const https = require('https')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const crypto = require('crypto')
const mysql = require('mysql')
const fs = require('fs')
const config = require('./config.json')
const path = require('path')

const voted = []
const connection = mysql.createConnection(config.connection)
const app = express()
const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, config.server.key)),
  cert: fs.readFileSync(path.join(__dirname, config.server.cert)),
  ca: fs.readFileSync(path.join(__dirname, config.server.ca))
}, app)
const io = require('socket.io')(server)

app.use(cors())
app.use(bodyParser.json())

const authenticate = (req, res, next) => {

  // Bypass Login
  if (config.bypassLogin) {
    next()
    return
  }

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
  ], error => {
    if (error) {
      res.json({ok: false, error: 'Already voted.'})
      return
    }
    voted.push(req.body.enroll)
    res.json({ok: true})
    io.sockets.emit('vote', form)
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
    server.listen(config.server.port, () => {
      console.log(`Serving from ${config.server.port}`)
    })
  })
})

io.on('connection', socket => {
  connection.query('select * from votes', (_, results) => {
    socket.emit('votes', results.reduce((votes, vote) => {
      votes.risingStar[vote.rising_star] = (votes.risingStar[vote.rising_star] || 0) + 1
      votes.sportsIcon[vote.sports_icon] = (votes.sportsIcon[vote.sports_icon] || 0) + 1
      votes.face.male[vote.face_male] = (votes.face.male[vote.face_male] || 0) + 1
      votes.face.female[vote.face_female] = (votes.face.female[vote.face_female] || 0) + 1
      votes.styleIcon.male[vote.style_icon_male] = (votes.styleIcon.male[vote.style_icon_male] || 0) + 1
      votes.styleIcon.female[vote.style_icon_female] = (votes.styleIcon.female[vote.style_icon_female] || 0) + 1
      votes.persona.male[vote.persona_male] = (votes.persona.male[vote.persona_male] || 0) + 1
      votes.persona.female[vote.persona_female] = (votes.persona.female[vote.persona_female] || 0) + 1
      votes.artist.male[vote.artist_male] = (votes.artist.male[vote.artist_male] || 0) + 1
      votes.artist.female[vote.artist_female] = (votes.artist.female[vote.artist_female] || 0) + 1
      return votes
    }, {
      risingStar: {},
      sportsIcon: {},
      face: {male: {}, female: {}},
      styleIcon: {male: {}, female: {}},
      persona: {male: {}, female: {}},
      artist: {male: {}, female: {}}
    }))
  })
})
