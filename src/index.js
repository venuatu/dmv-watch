import 'core-js/fn/object/assign';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/Main';
import { Router, Route, Link, browserHistory } from 'react-router'
require("react-tap-event-plugin")();

// Render the main component into the dom
ReactDOM.render((
  <Router history={browserHistory}>
    <Route path="/" component={App} />
    <Route path="/:day" component={App} />
  </Router>
), document.getElementById('app'));
