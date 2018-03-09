exports.user = user => ({
    raw: user,
    id: user.user_id,
    username: user.username,
    name: user.username,
    fullName: user.first_name + user.last_name,
    email: user.email,
    image: ""
})

exports.message = (state, message) => {
    message = JSON.parse(message);
    return {
        raw: message,
        id: message.id,
        author: state.users[message.user_id],
        text: message.message
    }
}