// 'use strict'

const express = require('express')
const app = require('express')()
const path = require('path')

const server = require('http').Server(app)
const io = require('socket.io')(server)

const groups = {
  'OIH-EXP': {
    users: [],
    estimations: [],
    card: null,
    cards: [],
    sockets: []
  },
  'OIH-RES': {
    users: [],
    estimations: [],
    card: null,
    cards: [],
    sockets: []
  },
  'OIH-MHB': {
    users: [],
    estimations: [],
    card: null,
    cards: [],
    sockets: []
  },
  'Hebex': {
    users: [],
    estimations: [],
    card: null,
    cards: [],
    sockets: []
  },
}

io.on('connection', (socket) => {
    let connection = {
      type: 'connection',
      msg: {
        groups: Object.keys(groups)
      }
    }
    io.emit('message', connection)
    socket.on('message', (msg) => {
      let response = null
      response = prepare(msg, groups[msg['group']], socket)
      io.emit('message', response)
    })
    socket.on('disconnect', () => {
      var groupName
      Object.entries(groups).forEach(([key, value]) => {
        const socketObj = value.sockets.find(socketObj => socketObj.socketId === socket.id)
        if (socketObj) {
          groupName = key
          value.sockets = value.sockets.filter(socketObj => socketObj.socketId !== socket.id)
          value.users = value.users.filter(user => user.username !== socketObj.username)
          value.estimations = value.estimations.filter(estimation => estimation.username !== socketObj.username)
        }
      })

      if (groupName) {
        let response = {
          type: 'log out',
          group: groupName,
          msg: {
            users: groups[groupName]['users'],
            estimations: groups[groupName]['estimations'],
            card: groups[groupName]['card'],
            cards: groups[groupName]['cards'],
          }
        }
        io.emit('message', response);
      }

    })
  }
)

if (module === require.main) {
  const PORT = process.env.PORT || 80
  server.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
    console.log('Press Ctrl+C to quit.')
  })
}

function prepare (data, group, socket) {
  let response = null
  switch (data['type']) {
    case 'get groups':
      response = {
        type: 'get groups',
        msg: {
          groups: Object.keys(groups)
        }
      }
      break
    case 'check group name':
      let isRepeated = false
      for (const group of Object.keys(groups)) {
        if (group.toLowerCase() === data['msg']['groupName'].toLowerCase()) {
          isRepeated = true
        }
      }
      if (!isRepeated) {
        const newGroup = {
          users: [],
          estimations: [],
          card: null,
          cards: [],
          sockets: []
        }
        groups[data['msg']['groupName']] = newGroup

      }
      response = {
        type: 'check group name',
        msg: {
          isSafeToCreate: !isRepeated,
          groups: Object.keys(groups)
        }
      }
      break
    case 'login':
      let isExisted = false
      let oldUser = null
      for (let user of group['users']) {
        if (user['username'].toLowerCase() === data['msg']['username'].toLowerCase()) {
          isExisted = true
          user['isEstimated'] = false
          oldUser = user
        }
      }
      const socketObj = {
        username: data['msg']['username'],
        socketId: socket.id
      }

      if (!isExisted) {
        group['users'].push(data['msg'])
        group['sockets'].push(socketObj)
      }
      response = {
        type: 'login',
        group: data['group'],
        msg: {
          isExisted: isExisted,
          oldUser: oldUser,
          users: group['users'],
          estimations: group['estimations'],
          card: group['card'],
          cards: group['cards'],
        }
      }
      break
    case 'estimation':
      let isExistedOne = false
      for (let estimation of group['estimations']) {
        if (estimation['username'] === data['msg']['username']) {
          isExistedOne = true
          estimation['point'] = data['msg']['point']
        }
      }
      if (!isExistedOne) {
        group['estimations'].push(data['msg'])
      }

      for (let user of group['users']) {
        if (user['username'] === data['msg']['username']) {
          user['isEstimated'] = true
        }
      }
      response = {
        type: 'estimation',
        group: data['group'],
        msg: {
          estimations: group['estimations'],
          users: group['users'],
          cards: group['cards'],
        }
      }
      break
    case 'replay':
      group['estimations'] = []
      for (let user of group['users']) {
        user['isEstimated'] = false
      }
      response = {
        type: 'replay',
        group: data['group'],
        msg: {
          users: group['users'],
          estimations: group['estimations'],
          card: group['card'],
          cards: group['cards'],
        }
      }
      break
    case 'open poker':
      let index = 0
      for (let i = 0; i < group['cards'].length; i++) {
        if (group['cards'][i]['cardNumber'] === data['msg']['cardNumber']) {
          index = i
        }
      }
      group['cards'][index]['storyPoints'] = data['msg']['storyPoint']
      group['cards'][index]['history'].push(data['msg']['estimations'])
      response = {
        type: 'open poker',
        group: data['group'],
        msg: {
          card: data['msg'],
          cards: group['cards'],
        }
      }
      break
    case 'put card':
      for (let user of group['users']) {
        user['isEstimated'] = false
      }

      let isExistedTwo = false
      for (let card of group['cards']) {
        if (card['cardNumber'] === data['msg']['cardNumber']) {
          isExistedTwo = true
        }
      }
      if (!isExistedTwo) {
        group['cards'].push(data['msg'])
      }
      group['card'] = (data['msg'])
      response = {
        type: 'put card',
        group: data['group'],
        msg: {
          users: group['users'],
          card: group['card'],
          cards: group['cards'],
        }
      }
      break
    case 'end':
      group['card'] = null
      group['users'] = []
      group['estimations'] = []
      response = {
        type: 'end',
        group: data['group'],
        msg: {
          users: group['users'],
          estimations: group['estimations'],
          card: group['card'],
          cards: group['cards'],
          groups: Object.keys(groups)
        }
      }
      break
    case 'log out':
      let indexOne = 0
      for (let i = 0; i < group['users'].length; i++) {
        if (group['users'][i]['username'] === data['msg']['username']) {
          indexOne = i
        }
      }

      group['users'].splice(indexOne, 1)
      for (let i = 0; i < group['estimations']; i++) {
        if (group['estimations'][i]['username'] === data['msg']['username']) {
          indexOne = i
        }
      }
      group['estimations'].splice(indexOne, 1)
      if (group['users'].length === 0) {
        group['card'] = null
        group['estimations'] = []
      }
      response = {
        type: 'log out',
        group: data['group'],
        msg: {
          users: group['users'],
          estimations: group['estimations'],
          card: group['card'],
          cards: group['cards'],
        }
      }
      break
    default:
      break
  }
  return response
}

