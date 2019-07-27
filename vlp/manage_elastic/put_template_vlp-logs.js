'use strict'
process.on('uncaughtException', (err) => { console.log(err) })

const es_host = process.argv[2]

const elasticsearch = require('elasticsearch')
const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var params = {
  name: 'vlp-logs',
  body: {
    index_patterns: ['vlp-logs-*'],
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
        bytes: { type : 'integer' },
        c_ip: { type : 'keyword' },
        cname: { type : 'keyword' },
        http_status: { type : 'keyword' },
        method: { type: 'keyword' },
        path: { type : 'text' },
        user_agent: { type: 'text' }
      }
    }
  }
}

elastic.indices.putTemplate(params, (err, res) => {
  if (err) {
    console.log(err)
  }
  else {
    console.log(res)
  }
})