const express = require('express')

const server = express()
const port = 8080

server.use(express.static('public'))

server.get('/', (_, response) => {
    response.send('index.html')
})

server.listen(port, () => {
    console.log(`Server started on port ${port}`)
})
