import {
  createReadStream,
  createWriteStream,
  watchFile
} from 'node:fs'

import {
  access,
  constants,
  readFile,
  writeFile
} from 'node:fs/promises'

import {
  resolve
} from 'node:path'

import express from 'express'

import csv from 'csvtojson'

import {
  deleteSync as del
} from 'del'

del(['./json/*.json'])

/**
 *  I literally threw this all together DON'T JUDGE ME
 */

function transform (buffer) {
  return (
    Buffer.from(JSON.stringify(buffer.toString().split(String.fromCodePoint(10)).filter(Boolean).map(JSON.parse)))
  )
}

console.log('RESET')

const PORT = 3001
const app = express()

const reader = createReadStream('./csv/WUR_portal.csv')
const writer = createWriteStream('./json/WUR_portal.json')

reader.pipe(csv()).pipe(writer)

let IN_MEMORY = []
const memoryMap = new Map()

writer.on('close', () => {
  watchFile('./json/WUR_portal.json', async () => {
    const fileData = await readFile('./json/WUR_portal.json')
    IN_MEMORY = JSON.parse(fileData.toString())
    memoryMap.clear()
  })
})

writer.on('close', async () => {
  await writeFile('./json/WUR_portal.json', transform(await readFile('./json/WUR_portal.json')))
})

writer.on('close', () => {
  console.log('READY')
})

/**
 *  Streaming
 *
 *  `res.sendFile(filePath)` and `createReadStream(filePath).pipe(res)` are either
 *  equally fast or `createReadStream()` is fastest
 *
 *  `res.send(IN_MEMORY)` is slowest
 */

/**
 *  Fastest/tie
 */
app.get('/send-file', (req, res) => {
  res.sendFile(resolve('./json/WUR_portal.json'))
})

/**
 *  Fastest/tie
 */
app.get('/create-read-stream', (req, res) => {
  createReadStream('./json/WUR_portal.json').pipe(res)
})

/**
 *  Slowest
 */
app.get('/send', async (req, res) => {
  const fileData = await readFile('./json/WUR_portal.json')
  res.send(fileData)
})

/**
 *  Slowest
 */
app.get('/in-memory', (req, res) => {
  res.send(IN_MEMORY)
})

/**
 *  Silliest
 */
app.get('/create-read-stream/from-csv', (req, res) => {
  createReadStream('./csv/WUR_portal.csv').pipe(csv()).pipe(res)
})

/**
 *  Filtering
 *
 *  memoryMap and IN_MEMORY are consistently fast although streaming is, again, faster once the file has been generated
 */
app.get('/memorymap/year/:year', async ({ params: { year } }, res) => {
  if (!memoryMap.has(year)) memoryMap.set(year, IN_MEMORY.filter((row) => row.year === year))

  res.send(memoryMap.get(year))
})

app.get('/in-memory/year/:year', ({ params }, res, next) => {
  const {
    year
  } = params

  params.filePath = resolve(`./json/WUR_portal.${year}.json`)

  next()
}, async ({ params }, res, next) => {
  const {
    filePath
  } = params

  try {
    await access(filePath, constants.R_OK)
  } catch {
    const {
      year
    } = params
    const yearData = IN_MEMORY.filter((row) => row.year === year)
    await writeFile(filePath, JSON.stringify(yearData))
  }

  next()
}, async ({ params: { filePath } }, res) => {
  res.sendFile(filePath)
})

app.get('/middleware/year/:year', ({ params }, res, next) => {
  const {
    year
  } = params

  params.filePath = resolve(`./json/WUR_portal.${year}.json`)

  next()
}, async ({ params }, res, next) => {
  const {
    filePath
  } = params

  try {
    await access(filePath, constants.R_OK)
  } catch {
    const {
      year
    } = params
    const fileData = await readFile('./json/WUR_portal.json')
    const yearData = JSON.parse(fileData.toString()).filter((row) => row.year === year)
    await writeFile(filePath, JSON.stringify(yearData))
  }

  next()
}, async ({ params: { filePath } }, res) => {
  res.sendFile(filePath)
})

app.get('/year/:year', async ({ params: { year } }, res) => {
  const filePath = resolve(`./json/WUR_portal.${year}.json`)

  try {
    await access(filePath, constants.R_OK)

    return res.sendFile(filePath)
  } catch {
    const fileData = await readFile('./json/WUR_portal.json')
    const yearData = JSON.parse(fileData.toString()).filter((row) => row.year === year)

    res.send(yearData).on('close', async () => {
      await writeFile(filePath, JSON.stringify(yearData))
    })
  }
})

app.listen(PORT, () => {
  console.log(PORT)
})
