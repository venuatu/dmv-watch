import React from 'react';
import { Link } from 'react-router'
import darkBaseTheme from 'material-ui/styles/baseThemes/darkBaseTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import AutoComplete from 'material-ui/AutoComplete';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import ChevronLeft from 'material-ui/svg-icons/navigation/chevron-left';
import ChevronRight from 'material-ui/svg-icons/navigation/chevron-right';
const _ = require('lodash');
const d3scale = require('d3-scale');
const moment = require('moment');
const crypto = require('crypto');
require('normalize.css/normalize.css');
require('styles/App.scss');
require('isomorphic-fetch');
import OFFICES from '../stores/offices';

const OFFICE_BY_NAME = _.reduce(OFFICES, (agg, n) => (
  agg[n.name] = n,agg
), {});
const OFFICE_KEYS = _.keys(OFFICE_BY_NAME);
const DATE_FORMAT = 'YYYY-MM-DD';

function hashCode(key) {
  let hash = crypto.createHash('md5');
  hash.update(key);
  let str = hash.digest('base64');
  var hashcode = 0;
  if (str.length == 0) return hashcode;
  for (let i = 0; i < str.length; i++) {
      hashcode = str.charCodeAt(i) + ((hashcode << 5) - hashcode) | 0;
  }
  return hashcode;
}

const color = _.memoize(function (key) {
  let code = Math.abs(hashCode(key));
  return `hsl(${code % 360}, 100%, ${((code / 360 % 50) | 0) + 30}%)`;
});

function milesBetween(a, b) {
  if (!a || !b) return Infinity;
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(b.latitude-a.latitude);  // deg2rad below
  var dLon = deg2rad(b.longitude-a.longitude); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(a.latitude)) * Math.cos(deg2rad(b.latitude)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d * 0.621371;// to miles
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

class AppComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      location: 'San Francisco',
    };

    _.each(this, function (v, k) {
      if (_.isFunction(v)) {
        this[k] = v.bind(this);
        console.log('bind', k);
      }
    });

    this.onResize = _.debounce(this.onResize, 300);
    this.componentWillReceiveProps(this.props);
  }

  componentWillReceiveProps(props) {
    let day = props.params.day || moment().format(DATE_FORMAT);
    fetch('/data/'+ day).then((resp) => {
      return resp.json().then((arr) => {
        // console.log(arr);
        _.each(arr, function (item) {
          item.date = moment(item.time, 'HH:mm:ss.SSS');
          _.each(item.times, function (time) {
            _.each(time, function (v, k) {
              time[k] = v - 0;
            });
          });
        });
        this.setState({
          data: {
            [day]: arr,
          },
        });
      }).catch((err) => {
        if (err instanceof SyntaxError) {
          this.setState({
            data: {
              [day]: [],
            },
          });
        }
      });
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize)
  }

  onResize() {
    this.setState({width: window.innerWidth});
  }

  createGraph(times, day) {
    let dimensions = {
      x: window.innerWidth - 40,
      y: 250,
    };
    let x = d3scale.scaleLinear()
      .range([0, dimensions.x])
      .domain([+moment({h: 8}), +moment({h: 18})]);
    let y = d3scale.scaleLinear()
      .range([dimensions.y, 0]);

    let nearMainLocation = _.memoize((id) => {
      let home = OFFICE_BY_NAME[this.state.location]
      // console.log(this.state.location, home, id, OFFICES[id])
      return milesBetween(home, OFFICES[id]) < 15;
    });
    let datasets = {};
    _.chain(times).
      sortBy('date').
      each((item) => {
        _.each(item.times, (v, id) => {
          if (nearMainLocation(id)) {
            _.each(v, (val, prop) => {
              let key = `${id}_${prop}`;
              if (!datasets[key]) datasets[key] = [];
              if (val === (_.last(datasets[key]) || {}).val) return;
              datasets[key].push({
                time: item.date.toDate(),
                val: val,
              });
            });
          }
        });
      }).
      value();

    let maxValue = _.chain(datasets).
      map(_.identity).
      flatten().
      map('val').
      max().
      value();
    y.domain([0, maxValue]);
    return (
      <div key={day}>
        <h3 style={{textAlign: 'center'}}>
          {moment(day, DATE_FORMAT).format('dddd, MMMM Do YYYY')}
        </h3>
        <div style={{textAlign: 'center'}}>
          <svg height={dimensions.y} width={dimensions.x}>
            {_.map(_.range(10, 18, 2), (hour) => {
              let val = x(+moment({h: hour}));
              return (
                <line key={`x_${hour}`} x1={val} y1={dimensions.y} x2={val} y2="0" strokeWidth="0.5" stroke="white"/>
              )}
            )}
            {_.map(_.range(10, 18, 2), (hour) => {
              let time = moment({h: hour});
              let val = x(+time) + 4;
              return (
                <text key={`xt_${hour}`} x={val} y="12"
                      fontFamily="Verdana, sans-serif"
                      fill="white"
                      fontSize="13">
                  {time.format('ha')}
                </text>
              )}
            )}
            {_.map(_.range(0, maxValue, 30), (yy) => {
              let val = y(yy);
              return (
                <line key={`y_${yy}`} x1={dimensions.x} y1={val} x2="0" y2={val} strokeWidth="0.5" stroke="white"/>
              )}
            )}
            {_.map(_.range(60, maxValue, 60), (yy) => {
              let val = y(yy);
              return (
                <text key={`yt_${yy}`} x="0" y={val - 4}
                      fontFamily="Verdana, sans-serif"
                      fill="white"
                      fontSize="13">
                  {(yy / 60 | 0)}h
                </text>
              )}
            )}
            {_.map(datasets, (v, k) => (
              <path key={`line_${k}`} d={
                'M '+ _.map(v, (v) => (
                  `${x(+v.time)} ${y(v.val)}`
                )).join(' L ')
              } stroke={color(k)} strokeWidth="1.5" fill="transparent" />
            ))}
          </svg>
        </div>
        <ul style={{
          listStyleType: 'none',
          padding: 0,
          margin: '1em',
          WebkitColumnCount: window.innerWidth / 310 | 0,
          MozColumnCount: window.innerWidth / 310 | 0,
          columnCount: window.innerWidth / 310 | 0,
        }}>
        {_.chain(datasets).keys().sortBy((k) => {
          let [id, type] = k.split('_');
          return OFFICES[id].name;
        }).map((k) => {
          let [id, type] = k.split('_');
          return (
            <li key={k} style={{
              borderLeft: `2em solid ${color(k)}`,
              paddingLeft: '0.5em',
            }}>{OFFICES[id].name} {type === 'withAppt' && 'appointment' || ''}</li>
          )}
        ).value()}
        </ul>
      </div>
    );
  }

  render() {
    let data = (this.state || {}).data;
    let graphs = _.chain(data).
      keys().
      sortBy().
      map((key) => this.createGraph.call(this, data[key], key)).
      value();
    let prev = moment(this.props.params.day).add(-1, 'day').format(DATE_FORMAT);
    let next = moment(this.props.params.day).add(1, 'day').format(DATE_FORMAT);

    return (
      <MuiThemeProvider muiTheme={getMuiTheme(darkBaseTheme)}>
        <div className="index">
          {graphs}
          <div style={{position: 'absolute', left: 0, top: 0, right: 0}}>
            <Link to={`/${prev}`} style={{float: 'left'}}>
              <ChevronLeft style={{width: '40px', height: '40px'}} />
            </Link>
            <Link to={`/${next}`} style={{float: 'right'}}>
              <ChevronRight style={{width: '40px', height: '40px'}} />
            </Link>
          </div>
        </div>
      </MuiThemeProvider>
    );
  }
}

          // <AutoComplete
          //   floatingLabelText="Enter your closest DMV"
          //   filter={AutoComplete.caseInsensitiveFilter}
          //   dataSource={OFFICE_KEYS}
          // />


AppComponent.defaultProps = {
};

export default AppComponent;
