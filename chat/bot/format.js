exports.user = user => ({
    raw: user,
    id: user.id,
    name: user.username,
    fullName: user.first_name + user.last_name,
    email: user.profile.email,
    image: ""
})

exports.message = (state, message) => ({
    raw: message,
    id: message.ts,
    author: state.users[message.user] || state.users[message.bot_id],
    text: state.removeFormatting(message.text)
})