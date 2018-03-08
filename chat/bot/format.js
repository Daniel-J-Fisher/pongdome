exports.user = user => ({
    raw: user,
    id: user.id,
    name: user.username,
    fullName: user.first_name + user.last_name,
    email: user.email,
    image: ""
})

exports.message = (state, message) => ({
    raw: message,
    id: message.id,
    author: state.users[message.user_id] || state.users[message.bot_id],
    text: message.message
})