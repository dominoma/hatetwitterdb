import express from 'express'
import { MongoClient } from 'mongodb'
import fs from 'fs'
import readline from 'readline'
import { Hashtag } from '~/types'

const url = 'mongodb://localhost:27017'
const dbName = 'hatetwitter'
const client = new MongoClient(url)

const app = express()
const port = 5000

client
  .connect()
  .then(() => {
    const db = client.db(dbName)
    const collection = db.collection('hashtags')

    app.get('/hashtag/:name', async (req, res) => {
      const hashtagList = await collection
        .find({ _id: req.params.name })
        .toArray()
      res.header('Access-Control-Allow-Origin', '*')
      if (hashtagList.length === 0) {
        res
          .status(404)
          .send({ error: `hashtag '${req.params.name}' not found!` })
      } else {
        const ranking =
          (await collection.count({
            'tweets.total': { $gt: hashtagList[0].tweets.total }
          })) + 1
        res.send({ ...hashtagList[0], ranking })
      }
    })

    app.get('/tophashtags', async (req, res) => {
      const hashtagList = await collection
        .aggregate([
          { $sort: { 'tweets.total': -1 } },
          { $limit: parseInt(req.query.count || '10', 10) }
        ])
        .toArray()
      res.header('Access-Control-Allow-Origin', '*')
      if (req.query.full === 'true') {
        res.send(hashtagList)
      } else {
        res.send(
          hashtagList.map(
            ({ name, topTweetId, tweets, tweetDates }: Hashtag) => ({
              name,
              topTweetId,
              tweets,
              hypePeak: Object.entries(tweetDates).sort(
                (a, b) => b[1].total - a[1].total
              )[0][0]
            })
          )
        )
      }
    })

    app.get('/import', async (_req, res) => {
      await collection.drop()
      const fileStream = fs.createReadStream('hashtags.json')

      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })
      for await (const line of rl) {
        const doc = JSON.parse(line)
        await collection.insertOne({ _id: doc.name, ...doc })
      }
      res.send('SUCCESS')
    })

    app.listen(port, () =>
      console.log(`Example app listening on port ${port}!`)
    )
  })
  .catch(console.error)
