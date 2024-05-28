const express = require('express')

const server = express()
const port = 8080

server.get('/', (_, response) => {
    response.send('OK!')
})

server.listen(port, () => {
    console.log(`Server started on port ${port}`)
})
