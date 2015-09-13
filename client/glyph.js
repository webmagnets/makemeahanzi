Session.setDefault('glyph.data', undefined);
Session.setDefault('glyph.selected_point', undefined);
Session.setDefault('glyph.show_strokes', true);

var COLORS = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
              '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];

function change_glyph(method, glyph) {
  glyph = glyph || Session.get('glyph.data');
  Meteor.call(method, glyph, function(err, data) {
    data = fill_glyph_fields(data);
    Session.set('glyph.data', data);
    if (method === 'save_glyph') {
      refresh_fraction_verified();
    } else {
      Session.set('glyph.show_strokes', true);
    }
  });
}

function fill_glyph_fields(glyph) {
  glyph.manual = glyph.manual || {};
  glyph.manual.verified = glyph.manual.verified || false;
  glyph.render = get_glyph_render_data(glyph, glyph.manual.bridges);
  glyph.manual.bridges = glyph.manual.bridges || glyph.render.bridges;
  return glyph;
}

function has_errors(glyph) {
  var error = function(pair) { return pair[0] != 'success'; };
  return glyph && glyph.render.log.filter(error).length > 0;
}

function refresh_fraction_verified() {
  Meteor.call('get_fraction_verified', function(err, data) {
    if (!err) {
      Session.set('glyph.fraction_verified', data);
    }
  });
}

window.get_glyph = function(name) {
  change_glyph('get_glyph', name);
}

function contains(bridges, bridge) {
  return remove_bridges(bridges, [bridge]).length < bridges.length;
}

function remove_bridges(add, remove) {
  var set = {};
  for (var i = 0; i < remove.length; i++) {
    set[to_line(remove[i]).coordinates] = true;
    set[to_line([remove[i][1], remove[i][0]]).coordinates] = true;
  }
  return add.filter(function(x) { return !set[to_line(x).coordinates]; });
}

function to_line(pairs) {
  return {
    x1: pairs[0][0],
    y1: pairs[0][1],
    x2: pairs[1][0],
    y2: pairs[1][1],
    coordinates: pairs[0].join(',') + ',' + pairs[1].join(','),
  };
}

function to_point(pair) {
  return {x: pair[0], y: pair[1], coordinates: pair.join(',')};
}

var bindings = {
  'w': function() {
    if (Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', false);
      Session.set('glyph.selected_point', undefined);
      var glyph = Session.get('glyph.data');
      glyph.manual.verified = false;
      change_glyph('save_glyph', glyph);
    } else {
      var glyph = Session.get('glyph.data');
      delete glyph.manual;
      Session.set('glyph.data', fill_glyph_fields(glyph));
    }
  },
  'a': function() {
    change_glyph('get_previous_glyph');
  },
  'A': function() {
    change_glyph('get_previous_glyph_skip_verified');
  },
  's': function() {
    var glyph = Session.get('glyph.data');
    if (!Session.get('glyph.show_strokes')) {
      Session.set('glyph.show_strokes', true);
      return;
    }
    if (glyph.manual.verified || !has_errors(glyph)) {
      glyph.manual.verified = !glyph.manual.verified;
      change_glyph('save_glyph', glyph);
    }
  },
  'd': function() {
    change_glyph('get_next_glyph');
  },
  'D': function() {
    change_glyph('get_next_glyph_skip_verified');
  },
};

Template.controls.events({
  'click #w-button': bindings.w,
  'click #a-button': bindings.a,
  'click #s-button': bindings.s,
  'click #d-button': bindings.d,
});

Template.controls.helpers({
  w_button_name: function() {
    return Session.get('glyph.show_strokes') ? 'Edit' : 'Reset';
  },
  s_button_name: function() {
    if (!Session.get('glyph.show_strokes')) {
      return 'View';
    }
    var glyph = Session.get('glyph.data');
    return glyph && glyph.manual.verified ? 'Flag' : 'Verify';
  },
});

Template.glyph.events({
  'click #glyph svg g line': function(e) {
    var coordinates = $(e.target).attr('data-coordinates');
    var xs = coordinates.split(',').map(function(x) {
      return parseInt(x, 10);
    });
    var bridge = [[xs[0], xs[1]], [xs[2], xs[3]]];
    var glyph = Session.get('glyph.data');
    glyph.manual.bridges = remove_bridges(glyph.manual.bridges, [bridge]);
    Session.set('glyph.data', fill_glyph_fields(glyph));
    Session.set('glyph.selected_point', undefined);
  },
  'click #glyph svg g circle': function(e) {
    var coordinates = $(e.target).attr('data-coordinates');
    var selected_point = Session.get('glyph.selected_point');
    if (selected_point === coordinates) {
      Session.set('glyph.selected_point', undefined);
      return;
    } else if (!selected_point) {
      Session.set('glyph.selected_point', coordinates);
      return;
    }
    var xs = (coordinates + ',' + selected_point).split(',').map(function(x) {
      return parseInt(x, 10);
    });
    var bridge = [[xs[0], xs[1]], [xs[2], xs[3]]];
    var glyph = Session.get('glyph.data');
    if (!contains(glyph.manual.bridges, bridge)) {
      glyph.manual.bridges.push(bridge);
      Session.set('glyph.data', fill_glyph_fields(glyph));
    }
    Session.set('glyph.selected_point', undefined);
  },
});

Template.glyph.helpers({
  glyph: function() {
    return !!Session.get('glyph.data');
  },
  verified: function() {
    var glyph = Session.get('glyph.data');
    if (has_errors(glyph)) {
      return 'error';
    }
    return glyph && glyph.manual.verified ? 'verified' : undefined;
  },
  log: function() {
    var glyph = Session.get('glyph.data');
    return glyph ? glyph.render.log.map(function(pair) {
      return {log_class: pair[0], log_message: pair[1]};
    }) : [];
  },
  base_color: function() {
    return Session.get('glyph.show_strokes') ? 'black' : 'gray';
  },
  d: function() {
    return Session.get('glyph.data').render.d;
  },
  show_strokes: function() {
    return !!Session.get('glyph.show_strokes');
  },
  strokes: function() {
    var glyph = Session.get('glyph.data');
    var result = [];
    for (var i = 0; i < glyph.render.strokes.length; i++) {
      var stroke = glyph.render.strokes[i];
      result.push({color: COLORS[i % COLORS.length], stroke: stroke});
    }
    return result;
  },
  bridges: function() {
    var glyph = Session.get('glyph.data');
    var original = {};
    for (var i = 0; i < glyph.render.bridges.length; i++) {
      var bridge = glyph.render.bridges[i];
      original[to_line(bridge).coordinates] = true;
      original[to_line([bridge[1], bridge[0]]).coordinates] = true;
    }
    var result = [];
    for (var i = 0; i < glyph.manual.bridges.length; i++) {
      var line = to_line(glyph.manual.bridges[i]);
      line.color = original[line.coordinates] ? 'red' : 'purple';
      result.push(line);
    }
    return result;
  },
  points: function() {
    var glyph = Session.get('glyph.data');
    var result = [];
    for (var i = 0; i < glyph.render.endpoints.length; i++) {
      var endpoint = glyph.render.endpoints[i];
      var point = to_point(endpoint.point);
      point.color = endpoint.corner ? 'red' : 'black';
      point.z_index = endpoint.corner ? 1 : 0;
      if (point.coordinates === Session.get('glyph.selected_point')) {
        point.color = 'purple';
      }
      result.push(point);
    }
    result.sort(function(p1, p2) { return p1.z_index - p2.z_index; });
    return result;
  },
});

Meteor.startup(function() {
  $('body').on('keypress', function(e) {
    var key = String.fromCharCode(e.which);
    if (bindings.hasOwnProperty(key)) {
      bindings[key]();
    }
  });
  if (!Session.get('glyph.data')) {
    change_glyph('get_next_glyph');
  }
  refresh_fraction_verified();
});
