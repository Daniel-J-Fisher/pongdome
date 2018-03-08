require('babel-polyfill');
require('isomorphic-fetch');
if (!global.WebSocket) {
    global.WebSocket = require('ws');
}

const { EventEmitter } = require('events');

const Client4 = require('mattermost-redux/client/client4.js').default;
const wsClient = require('mattermost-redux/client/websocket_client.js').default;

const config_file = require('./config');
const format = require('./format');


const indexBy = (prop, items) =>
  items.reduce((index, item) => (index[item[prop]] = item, index), {})

function MattermostBot() {
    const emitter = new EventEmitter();
    const web = new Client4;
    initConnections();
    const onError = err => emitter.emit('error', err);
    const state = {};

    const onMessage = message =>
        !message.subtype && emitter.emit('message', format.message(state, message));

    function initConnections(){
        let web = new Client4;
        web.setUrl(config_file.HTTP_URL);
        web.login(config_file.BOT_ID, config_file.BOT_PASSWORD)
            .then((me) => {
                console.log(`LOGIN SUCCESS AS ${me.email} !!!`);
                console.log(JSON.stringify(me));
                state.self = { id: me.id, name: me.username };
                state.token = web.getToken();
            })
            .then(()=>{
                web.getProfiles(0,200).then(users=>{
                    //There are two pages of users...
                    web.getProfiles(1,200).then(more_users=>{
                        let all_users = users.concat(more_users);
                        state.users = indexBy('id', all_users.map(format.user))
                    });
                });
            })
            .then(()=>{
                wsClient.setEventCallback(onMessage);
                wsClient.setErrorCallback(onError);
                wsClient.initialize(config_file.WEBSOCKET_URL,state.token);
                emitter.emit('load', state)
            })
            .catch((err)=>{
                console.error(err);
                emitter.emit('error', err);
            });
    }

    emitter.mention = user => `@${user.name}`;
    emitter.address = (user, text) => `${emitter.mention(user)}: ${text}`

    emitter.mentions = message =>
        (message.raw.text.match(/<@[^>]+>/g) || [])
            .map(tag => tag.slice(2, -1))
            .map(id => state.users[id]);

    emitter.isMentionned = (user, message) =>
        message.includes(`<@${user.id}>`) ||
        message.text.toLowerCase().split(/\s+/).includes(user.name.toLowerCase());

    emitter.send = (message, text) =>
        web.createPost({'channel_id':message.raw.channel,'message':text})
            .then(res => (res.message.channel = res.channel_id, res.message))
            .then(message => format.message(state, message));

    emitter.edit = (message, text) =>
        web.updatePost({'id':message.id,'message':text});

    return emitter;
}

module.exports = MattermostBot;