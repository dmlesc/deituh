'use strict';

const conf = require('../conf/env-local');

const elasticsearch = require('elasticsearch');
const elastic = new elasticsearch.Client({
  host: conf.elasticsearch_host
  //, log: 'trace'
});

var params = {
  name: 'ocsp_edge-reduced',
  //timeout: '10m',
  body: {
    template: 'ocsp_edge-reduced-*',
    settings: {
      number_of_shards: 4,
      number_of_replicas: 0    
    },
    mappings: {
      doc: {
        properties: {
          timestamp: { type: 'date', format: 'strict_date_optional_time' },
          c_ip: { type : 'keyword' },
          cs_method: { type: 'keyword' },
          cs_uri_stem: { type : 'text' },
          c_user_agent: { type: 'keyword' },
          cache_status: { type : 'keyword' },
          http_status: { type : 'keyword' },
          origin: { type : 'keyword' }
        }
      }
    }
  }
};


elastic.indices.putTemplate(params, (err, res) => {
  if (err)
    console.log(err);
  else
    console.log(res);
});

process.on('uncaughtException', (err) => {
  console.log(err);
});