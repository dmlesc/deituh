'use strict'
process.on('uncaughtException', (err) => { console.log(err) })

const es_host = process.argv[2]

const elasticsearch = require('elasticsearch')
const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var indices = ['vlp*']

elastic.indices.delete({ index: indices }, (err, res) => {
  if (err) {
    console.log(err)
  }
  else {
    console.log(res)
  }
})