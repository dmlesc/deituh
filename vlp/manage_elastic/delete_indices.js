'use strict'

const es_host = process.argv[2]

const elasticsearch = require('elasticsearch')
const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

//var indices = ['*-2016-12-*']
var indices = ['vlp']

elastic.indices.delete({ index: indices }, (err, res) => {
  if (err)
    console.log(err)
  else {
    console.log(res)
  }
})