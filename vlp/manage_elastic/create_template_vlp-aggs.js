'use strict'
process.on('uncaughtException', (err) => { console.log(err) })

const es_host = process.argv[2]

const elasticsearch = require('elasticsearch')
const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var params = {
  name: 'vlp-aggs',
  //timeout: '10m',
  body: {
    index_patterns: ['vlp-aggs-*'],
    settings: {
      number_of_shards: 8,
      number_of_replicas: 0
    },
    mappings: {
      _source: {
        enabled: true,
      },
      properties: {
        timestamp: { type: 'date', format: 'strict_date_optional_time' },
        aggs_type: { type : 'keyword' },
        '2xx': { type : 'integer' },
        '3xx': { type : 'integer' },
        '4xx': { type : 'integer' },
        '5xx': { type : 'integer' },
        total: { type: 'integer' },
        err_rate: { type: 'integer' },
        bytes_sent: { type: 'float' }
      }
    }
  }
}

elastic.indices.putTemplate(params, (err, res) => {
  if (err)
    console.log(err)
  else
    console.log(res)
})

