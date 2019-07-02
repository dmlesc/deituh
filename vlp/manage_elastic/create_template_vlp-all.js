'use strict'

const es_host = process.argv[2]

const elasticsearch = require('elasticsearch')
const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var params = {
  name: 'vlp-all',
  //timeout: '10m',
  body: {
    template: 'vlp-all-*',
    settings: {
      number_of_shards: 8,
      number_of_replicas: 0    },
    mappings: {
      doc: {
        properties: {
          timestamp: { type: 'date', format: 'strict_date_optional_time' },
          time_taken: { type : 'integer' },
          c_ip: { type : 'keyword' },
          filesize: { type : 'integer' },
          sc_status: { type : 'keyword' },
          sc_bytes: { type : 'integer' },
          cs_method: { type: 'keyword' },
          cs_uri_stem: { type : 'text' },
          rs_duration: { type: 'integer' },
          rs_bytes: { type: 'integer' },
          c_referrer: { type: 'keyword' },
          c_user_agent: { type: 'text' },
          cache_status: { type : 'keyword' },
          http_status: { type : 'keyword' },
          origin: { type : 'keyword' }
        }
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

process.on('uncaughtException', (err) => {
  console.log(err)
})