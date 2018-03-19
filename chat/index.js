const Table = require('cli-table2')
const fs = require('fs')
const numeral = require('numeral')
const io = require('socket.io-client')
const Stdbot = require('stdbot');
const uuid = require('uuid')

const makeConfig = require('../config')
const debug = require('../debug')('pongdome:chat')
const defaults = require('./config')
const actions = require('./actions')

const MattermostBot = require('./bot/mattermost_bot');

function makeBot(config) {
  const adapter = new MattermostBot();
  return Stdbot(adapter)
}

exports.run = function chat(config) {
  config = makeConfig(defaults, config)

  const bot = makeBot(config)
  const api = io(config.API_URL)

  debug('Bot listening and websocket connected');

  const admins = config.ADMINS ? config.ADMINS.split(',') : []
  const challenges = {}
  const matchesById = {}
  const matchesByThread = {}

  function saveState() {
    const state = Object.keys(matchesById).map(key => matchesById[key])
    fs.writeFileSync(`${__dirname}/state.json`, JSON.stringify(state, null, 2))
  }

  try {
    require('./state')
      .map(request => Object.assign({}, request, { message: bot.formatMessage(request.message) }))
      .forEach(addRequest)
  } catch (e) { }

  function findRequestThread(message) {
    const request = matchesByThread[message.thread]

    if (!request) {
      message.send('Could not find a challenge here.')
      throw new Error('Could not find a challenge here.')
    }

    return request
  }

  function findRequestUser(message) {
    const user = message.mentions()[0]

    const requests = Object.keys(matchesById)
      .map(id => matchesById[id])
      .filter(request => {
        const isAuthor = request.challenger.id === message.author.id ||
          (request.challengee && request.challengee.id === message.author.id)

        if (!user) return isAuthor

        return isAuthor ||
          request.challenger.id === user.id ||
          (request.challengee && request.challengee.id === user.id)
      })

    if (!requests || !requests.length) {
      message.send('Could not find a challenge here.')
      throw new Error('Could not find a challenge here.')
    }

    if (user) {
      return requests.find(request => {
        return (request.challenger.id === user.id && (!request.challenge || request.challengee.id === message.author.id)) ||
          ((!request.challengee || request.challengee.id === user.id) && request.challenger.id === message.author.id)
      })
    }

    if (requests.length > 1) {
      message.send('Multiple possible challenges, please mention your partner.')
      throw new Error('Multiple possible challenges, please mention your partner.')
    }

    return requests.pop()
  }

  function findRequest(message) {
    if (message.thread) return findRequestThread(message)
    else return findRequestUser(message)
  }

  function addRequest(request) {
    if (!request.id) request = Object.assign({ id: uuid.v4() }, request)

    if (matchesByThread[request.message.thread]) {
      request.message.send('There\'s already a challenge here.')
      throw new Error('There\'s already a challenge here.')
    }

    challenges[request.challenger.id] = challenges[request.challenger.id] || []
    challenges[request.challenger.id].push(request)

    if (request.challengee) {
      challenges[request.challengee.id] = challenges[request.challengee.id] || []
      challenges[request.challengee.id].push(request)
    }

    matchesById[request.id] = request

    if (request.message.thread) {
      matchesByThread[request.message.thread] = request
    }

    saveState()

    return request
  }

  function removeRequest({ id, challenger, challengee }) {
    if (challenges[challenger.id]) {
      challenges[challenger.id] = challenges[challenger.id]
        .filter(request => request.id !== id)
    }

    if (challenges[challengee.id]) {
      challenges[challengee.id] = challenges[challengee.id]
        .filter(request => request.id !== id)
    }

    const request = matchesById[id]

    delete matchesById[id]
    delete matchesByThread[request.message.thread]

    saveState()
  }

  function matchAll(regex, string) {
    let match
    const results = []
    while ((match = regex.exec(string)) != null) results.push(match)
    return results
  }

  const wordBoundary = /[ \n\r\t.,'"+!?-]/

  let botState

  bot.on('load', state => {
    botState = state
  })

  bot.on('message', message => {
    let results = matchAll(/(?:^|[^\w])#(\w+)/g, message.text)

    debug(JSON.stringify(message));
    debug('RESULTS LENGTH: ' + results.length);

    message.mentions = () => {
      return bot.mentions(message);
    }

    message.send = (text) => {
      return bot.send(message,text);
    }

    message.edit = (text)=>{
      return bot.edit(message,text);
    }

    if (!results.length) return

    const action = results[0][1].toLowerCase()

    if (!actions[action]) return

    const flags = results.slice(1).map(match => match[1])

    const flagsObject = flags.reduce((object, flag) => {
      object[flag] = true
      return object
    }, {})

    const isAdmin = admins
      .map(name => name.toLowerCase())
      .find(name => name === message.author.name.toLowerCase())

    debug(`@${message.author.name}: #${action}${message.mentions().map(x => x ? ` @${x.name}` : '').join('')}${flags.map(x => ` #${x}`).join('')} [${message.thread || 'dm'}]`)

    try {
      actions[action]({ api, bot, saveState, findRequest, addRequest, removeRequest, challenges, matchesById, matchesByThread, message, flags: flagsObject, isAdmin })
    } catch (err) {
      debug(err)
    }
  })

  bot.on('error', debug)

  api.on('match', ({ match }) => {
    if (!matchesById[match.id]) return
    const { challenger, challengee, message } = matchesById[match.id]
    message.send(`${bot.mention(challenger)} ${bot.mention(challengee)} Game on!`)
  })

  api.on('queue', ({ match, position }) => {
    if (!matchesById[match.id]) return
    const { challenger, challengee, message } = matchesById[match.id]
    message.send(`${bot.mention(challenger)} ${bot.mention(challengee)} Queued Up! You're ${numeral(position).format('0o')} in the queue.`)
  })

  api.on('progress', match => {
    const request = matchesById[match.id]

    if (!request) return
    if (!request.message.edit) return
    if (match.unranked) return

    const table = new Table({
      style: { head: [], border: [] }
    })

    const p1 = match.playerOne
    const p2 = match.playerTwo

    table.push(
      [p1.name, ...p1.games, p1.current],
      [p2.name, ...p2.games, p2.current]
    )

    const liveScore = '```\n' + table.toString() + '\n```'
    debug(liveScore);
    debug(request.progress);
    if (request.progress) {
      request.progress = request.message.edit(liveScore);
    } else {
      request.progress = request.message.send(liveScore)
    }
  })

  api.on('end', ({ match, winner, loser }) => {
    if (!matchesById[match.id]) return

    const request = matchesById[match.id]
    const winnerTotal = winner.games.reduce((a, b) => a + b, 0)
    const loserTotal = loser.games.reduce((a, b) => a + b, 0)

    request.message.send(`${bot.mention(winner.meta)} beat ${bot.mention(loser.meta)}! ${winnerTotal} points to ${loserTotal} points.`)
    removeRequest(request)
  })

  api.on('cancel', ({ match }) => {
    if (!matchesById[match.id]) return

    const request = matchesById[match.id]
    request.message.send('Game cancelled.')
    removeRequest(request)
  })
}

if (require.main === module) {
  exports.run()
}
