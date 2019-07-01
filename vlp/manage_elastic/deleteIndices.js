'use strict';
process.on('uncaughtException', (err) => {
  console.log(err);
});

const elasticsearch_host = '10.92.124.68:9200'

const elasticsearch = require('elasticsearch');
const elastic = new elasticsearch.Client({
  host: elasticsearch_host
  //, log: 'trace'
});

//var indices = ['*-2016-12-*'];
//var indices = ['ocsp_edge-reduced-*'];
var indices = ['vlp'];

elastic.indices.delete({ index: indices }, (err, res) => {
  if (err)
    console.log(err);
  else {
    console.log(res);
  }
});

