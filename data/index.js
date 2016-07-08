"use script";
process.env.TZ = 'America/Los_Angeles';
var _ = require('lodash');
var hl = require('highland');
var aws = require('aws-sdk');
var moment = require('moment');
var fs = require('fs');

aws.config.update({
  region: 'us-west-2',
  // logger: process.stdout,
});

var s3 = new aws.S3();
var dynamodb = new aws.DynamoDB.DocumentClient();
var lastKey = undefined;
var today = moment().format('YYYY-MM-DD');
var accum = {};

exports.run = run;
function run() {
  hl(function (push, next) {
    var params = {
      TableName: 'dmv-wait-times',
      ExclusiveStartKey: lastKey,
      ReturnConsumedCapacity: 'TOTAL', // optional (NONE | TOTAL | INDEXES)
      KeyConditionExpression: '#ean = :eav',
      ExpressionAttributeNames: {
        '#ean': 'date',
      },
      ExpressionAttributeValues: {
        ':eav': today,
      }
    };
    var startReq = Date.now();
    dynamodb.query(params, function(err, data) {
      console.error(`request time: ${Date.now() - startReq}ms`);
      if (err) {
        push(err); // an error occurred
      } else if (data.Items.length) {
        _.each(data.Items, (item) => {
          // console.log(_.pick(item, ['date', 'time']));
          push(null, JSON.parse(JSON.stringify(item)));
        });
        console.log(_.omit(data, ['Items']));
        lastKey = data.LastEvaluatedKey;
      }
      if (lastKey) {
        next();
      } else {
        push(null, hl.nil);
      }
    });
  }).map(function (item) {
    return {
      date: item.date,
      time: item.time,
      times: item.waittimes,
    };
  }).filter(function (item) {
    return !!_.keys(item.times).length;
  }).reduce(accum, function (agg, item) {
    if (!agg[item.date])
      agg[item.date] = [];
    agg[item.date].push(item);
    delete item.date;
    return agg;
  }).
  stopOnError(function (err) {
    console.error('err', err, err.stack);
  }).
  last().each(function () {
    console.log('each');
  }).done(function (arr) {
    write(accum);
  });
}

function write(agg) {
  var incragg = _.mapValues(agg, (v) => _.sortBy(v, 'time'));

  Promise.all(_.map(incragg, function (data, key) {
    var prev = {};
    var output = _.chain(data).map(function (item) {
      var times = _.pickBy(item.times, function (time, key) {
        if (!_.isEqual(time, prev[key])) {
          prev[key] = _.clone(time);
          return true;
        }
        return false;
      });
      if (_.keys(times).length) {
        return {
          time: item.time,
          times: times,
        };
      }
    }).compact().value();
    console.log(`${key}: ${data.length} -> ${output.length}`);
    // fs.writeFileSync('./output/'+ key, JSON.stringify(output));
    return s3.putObject({
      Bucket: 'ca-dmv-watch',
      Key: 'data/'+ key,
      ContentType: 'application/json',
      Body: JSON.stringify(output),
    }).promise();
  })).then(function () {

  }).catch(function (err) {
    console.error(err, err.stack);
  });
}
