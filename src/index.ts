require('dotenv').config()
const TwetchClient = require('@twetch/sdk')
import TwetchClientType from '@twetch/sdk'
import * as Parser from 'rss-parser'
import * as winston from 'winston'
const parser = new Parser()

type FeedItem = {
  author: string
  link: string
  title: string
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
  ],
})

const RSSURL = 'https://offers.staging.tonicpow.com/functions/campaignsFeed/'
var latestURL: string
var account: TwetchClientType

const getFeed = async (feedURL: string, latest: string) => {
  let feed = await parser.parseURL(feedURL)
  let foundItem = feed.items.findIndex((idx: FeedItem) => idx.link === latest)
  logger.log({ level: 'info', message: `${feed.title} Found item index: ${foundItem}` })
  if (foundItem > 0) {
    let items = feed.items.slice(0, foundItem)
    for (let item of items) {
      logger.info(`\u{1F4B2} New Campaign created by ${item.author}: ${item.title}\n\n${item.link}`)
      let content = `Testing something cool... \u{1F440}` //`New Campaign created by ${item.author}: ${item.title}\n\n${item.link}`
      let txid = await post(account, content, '', '', '', false, false)
      logger.info(`TXID: ${txid}`)
      await sleep(10000) // recommend to wait 10 seconds between broadcasts
    }
    latestURL = items[0].link
  }
}

const getLatestURL = async (url) => {
  let feed = await parser.parseURL(url)
  logger.info(`Latest URL: ${feed.items[0].link}`)
  return feed.items[0].link
}

function initTwetch() {
  const twetch: TwetchClientType = new TwetchClient({
    clientIdentifier: process.env.TWETCH_CLIENT_ID,
    privateKey: process.env.TWETCH_PK,
  })
  twetch.init()
  return twetch
}

async function getBalance(instance) {
  let balance = await instance.wallet.balance()
  logger.info(`Wallet balance: ${balance / 100000000} BSV`)
  return balance / 100000000
}

const post = async (
  instance: TwetchClientType,
  content: string,
  reply: string,
  branch: string,
  filesURL: string,
  tweet: boolean,
  hide: boolean
) => {
  try {
    let response = await instance.publish('twetch/post@0.0.1', {
      bContent: `${content}${branch}${filesURL}`,
      mapReply: reply,
      payParams: { tweetFromTwetch: tweet, hideTweetFromTwetchLink: hide },
    })
    return response.txid
  } catch (e) {
    logger.error(e)
    return null
  }
}

const sleep = (timeout: number) => {
  return new Promise((resolve) => setTimeout(resolve, timeout))
}

const main = async () => {
  account = initTwetch()
  getBalance(account)
  latestURL = await getLatestURL(`${RSSURL}?cacheBust=${Date.now()}`)
  while (true) {
    await getFeed(`${RSSURL}?cacheBust=${Date.now()}`, latestURL)
    await sleep(parseInt(process.env.TWETCH_REFRESH_RATE))
  }
}

main()
